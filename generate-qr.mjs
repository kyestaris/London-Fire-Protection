import QRCode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(__dirname, 'brand_assets', 'qr-code.png');

await QRCode.toFile(output, 'https://www.londonfireprotection.ca/#contact', {
  type: 'png',
  width: 1000,
  margin: 2,
  color: {
    dark: '#1A1A1A',
    light: '#FFFFFF',
  },
  errorCorrectionLevel: 'H',
});

console.log('QR code saved to', output);
