import serverless from 'serverless-http';

process.env.NODE_ENV = 'production';
process.env.NETLIFY = 'true';

const { default: app } = await import('../../server/index.js');

export const handler = serverless(app);
