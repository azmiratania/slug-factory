import { createRepository, createService, loadConfig } from './config';
import { createApp } from './infra/http/app';

const config = loadConfig();
const repository = createRepository();
const service = createService(repository, config);
const app = createApp(service);

app.listen(config.port, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      message: `URL shortener listening on port ${config.port}`,
      short_url_base: config.shortUrlBase,
    }),
  );
});
