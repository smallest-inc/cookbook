const frame = document.getElementById('frame');
const offline = document.getElementById('offline');
const retryBtn = document.getElementById('retry-btn');

frame.addEventListener('error', () => {
  frame.style.display = 'none';
  offline.style.display = 'flex';
});

retryBtn.addEventListener('click', () => {
  offline.style.display = 'none';
  frame.style.display = 'block';
  frame.src = 'http://localhost:3000?' + Date.now();
});
