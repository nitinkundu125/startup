export interface INDstocksOrderParams {
  symbol: string;
  quantity: number;
  transactionType: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  productType: 'DELIVERY' | 'INTRADAY';
  price?: number;
}

export async function executeINDstocksOrder(params: INDstocksOrderParams, accessToken: string) {
  // Base URL for INDstocks API
  const API_URL = 'https://api.indstocks.com/v1'; // Example URL, actual may vary based on exact documentation

  try {
    const payload = {
      exchange: 'NSE',
      symbol: params.symbol,
      transaction_type: params.transactionType,
      order_type: params.orderType,
      quantity: params.quantity,
      product_type: params.productType,
      price: params.price || 0,
      validity: 'DAY'
    };

    console.log('[INDstocks API] Sending Order:', payload);

    const response = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        // 'X-IP-Address': '<Your Static IP>' // INDstocks requires static IP whitelisting
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`INDstocks API Error: ${data.message || response.statusText}`);
    }

    return {
      success: true,
      orderId: data.order_id,
      message: 'Order placed successfully'
    };
  } catch (error: any) {
    console.error('[INDstocks API] Failed to place order:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
