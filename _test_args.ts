import { app, BrowserWindow } from 'electron';

app.whenReady().then(() => {
  console.log('=== process.argv ===', process.argv);
  console.log('=== ELECTRON_CLI_ARGS ===', process.env.ELECTRON_CLI_ARGS);
  app.quit();
});
