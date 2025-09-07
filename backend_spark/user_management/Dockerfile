# ---- build ----
FROM maven:3.9-eclipse-temurin-24 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -q -DskipTests package

# ---- runtime ----
FROM eclipse-temurin:24-jre
WORKDIR /app

# tools for healthcheck & scripting
RUN apt-get update && apt-get install -y --no-install-recommends curl bash && rm -rf /var/lib/apt/lists/*

ENV JAVA_OPTS="-XX:+UseZGC -XX:MaxRAMPercentage=75"
COPY --from=build /app/target/*.jar app.jar

# optional upload dir if your app uses it
RUN mkdir -p /data/uploads
ENV UPLOAD_BASE_DIR=/data/uploads

ENV SERVER_PORT=8080
EXPOSE 8080

ENTRYPOINT ["sh","-lc","exec java $JAVA_OPTS -jar app.jar"]
