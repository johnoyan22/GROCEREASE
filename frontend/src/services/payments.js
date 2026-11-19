export const channelLabel = method => ({ gcash: 'GCash', card: 'Debit / Credit Card', paymaya: 'Maya', grab_pay: 'GrabPay', qrph: 'QR Ph', shopee_pay: 'ShopeePay' }[method] ?? method);
export const providerLabel = provider => ({ xendit: 'Xendit (Test)', paymongo: 'PayMongo (Test)' }[provider] ?? 'Digital payment');
export function hostedPaymentUrl(value, provider) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (provider === 'xendit') {
      if (url.search || url.hash) return null;
      if (url.hostname === 'checkout-staging.xendit.co' && /^\/sessions\/ps-[a-f0-9]{24}$/.test(url.pathname)) return url.href;
      if (url.hostname === 'dev.xen.to' && /^\/[a-zA-Z0-9]{6,64}$/.test(url.pathname)) return url.href;
      return null;
    }
    return provider === 'paymongo' && url.hostname === 'checkout.paymongo.com' ? url.href : null;
  } catch { return null; }
}
