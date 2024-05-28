# Project-Bot

## Dependencies
- Docker
- Docker compose

## Run

### 1. Create .env file and fill the following template
```bash
# General
SERVER_ORIGIN= #The origin of the web server like http://localhost:3000
SECRET= #A random alphanumeric password
SERVER_PASSWORD= #A random alphanumeric password

# Discord
DISCORD_BOT_TOKEN= #From https://discord.com/developers/applications
DISCORD_BOT_ID= #From https://discord.com/developers/applications
DISCORD_BOT_CLIENT_SECRET= #From https://discord.com/developers/applications

# MYSQL
MYSQL_HOST= #The address of the MYSQL server like sql.projectbot
MYSQL_ROOT_PASSWORD= #An alpha numeric password
```

### 2. Build and run docker containers
Run following command in this directory
```bash
docker compose up
```
The application is now running and the web server can be accessed on `http://localhost:3000`