# AiLearningHub

Angular study tools for mind maps, YouTube notes, document summaries, and PDF chat. See [development, validation, and deployment instructions](DEPLOYMENT.md).

## Development server

Use Node.js 24 LTS. Run `npm ci --legacy-peer-deps`, copy `.env.example` to `.env`, configure the server credentials, and run `npm start`. Navigate to `http://localhost:4200/`. This starts Angular and the API proxy required for accounts and AI tools.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `npm run build`. Artifacts are stored in `dist/ai-learning-hub/browser`. Deploy with the serverless `api/` functions; a static-only host cannot run all features.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
