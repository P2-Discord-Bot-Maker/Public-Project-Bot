# Use the official MySQL image from Docker Hub
FROM mysql:latest

# Copy the SQL script into the container
COPY ./src/database/p2_database.sql /docker-entrypoint-initdb.d/