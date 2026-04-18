# ---- Frontend build ----
FROM docker.io/library/node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---- Backend build ----
FROM docker.io/library/golang:1.25-alpine AS backend
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -o /console ./cmd/console/

# ---- Runtime ----
FROM docker.io/library/alpine:3.21
RUN apk add --no-cache ca-certificates && \
    adduser -D -u 65534 appuser
WORKDIR /app
COPY --from=backend /console ./console
# Copy frontend dist into the embedded static dir location
COPY --from=frontend /app/frontend/dist ./static/
ENV FRONTEND_DIST=/app/static
USER appuser
EXPOSE 8080
CMD ["./console"]
