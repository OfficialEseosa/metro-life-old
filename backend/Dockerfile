# Metro Life API and live world server.
# Build from the repository root, because the build packages ../shared/*.json:
#   docker build -f backend/Dockerfile -t metro-life-api .
#   docker run -p 8080:8080 -v metro-data:/data -e METRO_ORIGINS=https://your-frontend.example metro-life-api
# Run exactly one container: the save file has a single writer and sessions live in memory.

FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY backend/pom.xml backend/pom.xml
RUN mvn -B -q -f backend/pom.xml dependency:go-offline
COPY shared shared
COPY backend/src backend/src
RUN mvn -B -q -f backend/pom.xml -Dmaven.test.skip=true package \
 && cp backend/target/backend-*.jar /app.jar

FROM eclipse-temurin:21-jre
# Plot atlases and billboard art are drawn with AWT, which needs fontconfig and a font even headless.
RUN apt-get update \
 && apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 metro \
 && mkdir -p /data \
 && chown metro /data
WORKDIR /app
COPY --from=build /app.jar /app/app.jar
COPY backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh
ENV METRO_DATA=/data/metro-life.json \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -Djava.awt.headless=true"
VOLUME ["/data"]
# The server listens on $PORT when the host sets it, otherwise 8080. Health check: GET /api/version.
EXPOSE 8080
# The entrypoint runs as root only long enough to chown the mounted /data, then drops to the `metro` user.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["java", "-jar", "/app/app.jar"]
