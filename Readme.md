
# PosBuzz

## Tech Stack

**Client:** React.js, TailwindCSS, AntD

**Server:** NestJS

**Database:** PostgreSQL


## API Reference

You may get a **Postman Collection** in the root folder


## Environment Variables

You may get `.env.example` in frontend and backend folder. Fill the variables with correct values.

## Run Locally

Clone the project

```bash
  git clone https://github.com/PosBuzz/PosClient.git
```

Setup the project

```bash
  npm run setup
```

Start the server

```bash
  npm run start
```

To use nodemon

```bash
  npm run dev
```


## Security

See [SECURITY-NOTES.md](SECURITY-NOTES.md) for accepted `npm audit` findings and the
dependency overrides in place, with the reasoning for each.

## Support

For support, email info@posbuzz.com 


## Node runtime

Use Node.js `>=22.22.1 <23` throughout the repo (`nvm install 22 && nvm use 22`). CI reads `.nvmrc`; all Node Docker build/runtime stages use `node:22-alpine`, including the images built by compose. `setup.sh` checks this range before installing dependencies.
