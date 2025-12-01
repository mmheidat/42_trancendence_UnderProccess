.PHONY: help up build down clean logs restart

up:
	docker-compose up -d

build:
	docker-compose up -d --build

down:
	docker-compose down

clean:
	docker-compose down -v
	docker rmi pong-frontend pong-backend 2>/dev/null || true

logs:
	docker-compose logs -f

restart: down build

check-env: ## Check if environment variables are loaded in backend
	@echo "Checking backend environment variables..."
	docker exec -it pong-backend printenv | grep GOOGLE
	@echo "\nChecking .env file in container..."
	docker exec -it pong-backend cat /app/.env