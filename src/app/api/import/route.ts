import { NextResponse } from 'next/server';
import { importMultipleTradebooks } from '@/lib/import-tradebook';
import { parseHoldingsCsv } from '@/lib/holdings-reconcile';
import { requireValidUser } from '@/lib/auth';
import { clearSessionCookie, getSessionUserId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

function isHoldingsFile(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('holding') && n.endsWith('.csv');
}

export async function POST(request: Request) {
  const user = await requireValidUser();
  if (!user) {
    if (await getSessionUserId()) await clearSessionCookie();
    return NextResponse.json(
      { error: 'Session expired. Please sign in again.', sessionExpired: true },
      { status: 401 }
    );
  }
  const userId = user.id;

  try {
    const formData = await request.formData();
    const replace = formData.get('replace') === 'true';
    const importType = (formData.get('importType') as string) || 'STOCK';
    const fileEntries = formData.getAll('files');

    const files: { name: string; content: string }[] = [];
    let holdingsSaved = false;

    for (const entry of fileEntries) {
      if (!(entry instanceof File) || !entry.name.toLowerCase().endsWith('.csv')) {
        continue;
      }
      if (isHoldingsFile(entry.name)) {
        const holdings = parseHoldingsCsv(await entry.text());
        if (holdings.length > 0) {
          await prisma.user.update({
            where: { id: userId },
            data: { holdingsSnapshot: JSON.stringify(holdings) },
          });
          holdingsSaved = true;
        }
        continue;
      }
      files.push({ name: entry.name, content: await entry.text() });
    }

    if (files.length === 0) {
      return NextResponse.json(
        {
          error: holdingsSaved
            ? 'Holdings saved. Upload at least one tradebook CSV.'
            : 'Upload at least one CSV tradebook file.',
        },
        { status: 400 }
      );
    }

    const result = await importMultipleTradebooks(userId, files, replace, importType);

    if (result.totalImported === 0) {
      const allErrors = result.files.flatMap((f) => f.errors);
      if (allErrors.length > 0) {
        return NextResponse.json(
          { error: 'Could not import tradebooks.', details: allErrors },
          { status: 400 }
        );
      }
    }

    revalidatePath('/');
    revalidatePath('/holdings');
    revalidatePath('/upload');

    return NextResponse.json({ success: true, holdingsSaved, ...result });
  } catch (e) {
    console.error('Import failed:', e);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return NextResponse.json(
        {
          error: 'Session expired or account not found. Please sign out and sign in again.',
          sessionExpired: true,
        },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Import failed. Please check your file format.' },
      { status: 500 }
    );
  }
}
