# Solar Weather History — Impact on Communication

A web application exploring the history of solar events and their effects on human communication systems, from the telegraph era to modern satellite networks.

🌐 **Live Site:** [solarimpacts.org](https://www.solarimpacts.org)

---

## What Is This?

Solar Weather History is an interactive historical timeline documenting solar flares, geomagnetic storms, and other space weather phenomena — and the disruptions they've caused to communication infrastructure throughout history.

The project aims to make this often-overlooked intersection of space science and human history accessible and engaging to a general audience.

---

## Features

- **Interactive Timeline** — Browse solar events by year, with detailed summaries and impact descriptions for each event
- **Historical Newspaper Articles** — View original newspaper scans and media coverage of major solar events
- **AI-Powered Explanations** — "Tell Me More" generates an expanded, conversational explanation of any event using AI
- **Birthday Lookup** — Enter your birthday and discover what solar events occurred on that date throughout history, with an AI-generated narrative
- **Live Solar Data** — Dashboard for current space weather activity _(live integration in progress)_
- **About & Team** — Learn about the project and the people behind it

---

## Tech Stack

### Frontend

- [React 19](https://react.dev/) with [React Router](https://reactrouter.com/)
- [Vite](https://vitejs.dev/) — build tool and dev server
- Custom CSS per page

### Backend

- [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)
- [MySQL](https://www.mysql.com/) — data storage
- [DigitalOcean Spaces](https://www.digitalocean.com/products/spaces) — image and document storage
- [OpenAI API](https://openai.com/) — AI-powered features

### Hosting

- **Frontend:** [Vercel](https://vercel.com/)
- **API:** DigitalOcean Droplet
- **Database:** DigitalOcean Managed MySQL
- **DNS/SSL:** Cloudflare

---

## Pages

| Route       | Description                                         |
| ----------- | --------------------------------------------------- |
| `/`         | Main timeline — browse all solar events by year     |
| `/birthday` | Look up solar events that occurred on your birthday |
| `/live`     | Live solar activity dashboard                       |
| `/about`    | About the project and team                          |
| `/admin`    | Admin panel (authenticated access only)             |

---

## Project Status

This project is actively developed. The live data dashboard is a placeholder pending integration with a real-time solar weather API. All other features are fully functional.

---

## License

This project is private. All rights reserved.
