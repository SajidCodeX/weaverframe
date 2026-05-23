import http from 'http';

const urls = [
  '/',
  '/leads',
  '/reviews',
  '/ai-activity',
  '/appointments',
  '/messages',
  '/reports',
  '/settings'
];

async function checkUrl(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'text/html'
      }
    };

    const req = http.request(options, (res) => {
      resolve({ path, statusCode: res.statusCode });
    });

    req.on('error', (e) => {
      resolve({ path, error: e.message });
    });

    req.end();
  });
}

async function run() {
  console.log("Checking app routes...");
  for (const url of urls) {
    const res = await checkUrl(url);
    if (res.error) {
      console.log(`❌ localhost:8080${res.path} -> Error: ${res.error}`);
    } else {
      console.log(`${res.statusCode === 200 ? '✅' : '❌'} localhost:8080${res.path} -> StatusCode: ${res.statusCode}`);
    }
  }
}

run();
