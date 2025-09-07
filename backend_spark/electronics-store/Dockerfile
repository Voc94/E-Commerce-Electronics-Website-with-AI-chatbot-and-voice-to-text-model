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

ENV SERVER_PORT=8081
EXPOSE 8081

ENTRYPOINT ["sh","-lc","exec java $JAVA_OPTS -jar app.jar"]
