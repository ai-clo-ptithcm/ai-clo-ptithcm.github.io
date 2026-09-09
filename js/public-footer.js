(() => {
  if (location.pathname.endsWith('/app.html') || location.pathname === '/app.html') return;

  const host = document.querySelector('[data-public-footer]')
    || document.querySelector('footer.public-footer, footer.landing-footer, footer.tools-footer, footer.info-footer, footer.tool-footer')
    || document.querySelector('body > footer');
  if (!host) return;

  const links = [
    ['/', 'Trang chính', 'home'],
    ['/tools/', 'Công cụ CLO', 'tools'],
    ['/huong-dan.html', 'Hướng dẫn sử dụng', 'guide'],
    ['/cham-thi-clo/', 'Chấm thi CLO', 'grading'],
    ['/chinh-sach.html', 'Chính sách & bảo mật', 'policy'],
    ['/app.html', 'Vào hệ thống', 'app'],
  ];

  const path = location.pathname.replace(/\/index\.html$/, '/');
  const current = path === '/' ? 'home'
    : path.startsWith('/tools/') ? 'tools'
    : path === '/huong-dan.html' ? 'guide'
    : path.startsWith('/cham-thi-clo/') ? 'grading'
    : path === '/chinh-sach.html' ? 'policy'
    : '';

  host.className = 'public-footer-shared';
  host.setAttribute('data-public-footer', '1');
  host.innerHTML = `
    <span>© 2026 AI-CLO PTITHCM</span>
    <nav aria-label="Liên kết cuối trang">
      ${links.map(([href,label,key]) => `<a href="${href}"${key===current?' class="active"':''}${key==='app'?' target="_blank" rel="noopener"':''}>${label}</a>`).join('')}
    </nav>`;
})();
