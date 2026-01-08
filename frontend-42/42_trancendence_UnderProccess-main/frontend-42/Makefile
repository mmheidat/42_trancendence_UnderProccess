.PHONY: help up build down clean logs restart setup-ssl health

setup-ssl:
	cd nginx && ./generate-certs.sh

up:
	docker compose up -d

build:
	docker compose up -d --build

down:
	docker compose down

clean:
	docker compose down -v
	docker rmi pong-frontend pong-auth pong-user pong-game pong-chat pong-nginx pong-redis 2>/dev/null || true

fclean: clean
	docker system prune -a --volumes --force

logs:
	docker compose logs -f

logs-auth:
	docker compose logs -f auth-service

logs-user:
	docker compose logs -f user-service

logs-game:
	docker compose logs -f game-service

logs-chat:
	docker compose logs -f chat-service

restart: down build

health:
	@echo "Checking service health..."
	@curl -sk https://localhost:8443/health/auth || echo "auth-service: DOWN"
	@curl -sk https://localhost:8443/health/user || echo "user-service: DOWN"
	@curl -sk https://localhost:8443/health/game || echo "game-service: DOWN"
	@curl -sk https://localhost:8443/health/chat || echo "chat-service: DOWN"

