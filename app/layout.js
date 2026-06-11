import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: '오냥 - 유통기한 재고 관리',
  description: '사진 한 장으로 등록, 임박하면 알림',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
