(() => {
  const host = document.querySelector('[data-public-footer]');
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

  host.className = `${host.className || ''} public-footer-shared`.trim();
  host.innerHTML = `
    <span>© 2026 AI-CLO PTITHCM</span>
    <nav aria-label="Liên kết cuối trang">
      ${links.map(([href,label,key]) => `<a href="${href}"${key===current?' class="active"':''}${key==='app'?' target="_blank" rel="noopener"':''}>${label}</a>`).join('')}
    </nav>`;
})();
