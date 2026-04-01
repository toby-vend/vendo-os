import app from './server.js';

const PORT = parseInt(process.env.DASHBOARD_PORT || '3000', 10);

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) { app.log.error(err); process.exit(1); }
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
