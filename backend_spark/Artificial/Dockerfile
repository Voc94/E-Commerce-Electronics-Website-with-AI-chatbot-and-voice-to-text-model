# ---- build stage ----
FROM maven:3.9-eclipse-temurin-24 AS build
WORKDIR /app

# we use curl in this stage to vendor native jars
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# build the Spring Boot fat jar
COPY pom.xml .
COPY src ./src
RUN mvn -q -DskipTests package

# vendor the Linux (x86_64) PyTorch natives that your POM doesn't include
# versions must match your POM (DJL 0.34.0, native 2.7.1)
RUN mkdir -p /ext && \
    curl -fsSL -o /ext/pytorch-native-cpu-2.7.1-linux-x86_64.jar \
      https://repo1.maven.org/maven2/ai/djl/pytorch/pytorch-native-cpu/2.7.1/pytorch-native-cpu-2.7.1-linux-x86_64.jar && \
    curl -fsSL -o /ext/pytorch-jni-2.7.1-0.34.0.jar \
      https://repo1.maven.org/maven2/ai/djl/pytorch/pytorch-jni/2.7.1-0.34.0/pytorch-jni-2.7.1-0.34.0.jar

# ---- runtime stage ----
FROM eclipse-temurin:24-jre
WORKDIR /app

# tools for healthcheck & scripting
RUN apt-get update && apt-get install -y --no-install-recommends curl bash && rm -rf /var/lib/apt/lists/*

# helpful JVM opts; enable native access to silence JNA warning
ENV JAVA_OPTS="-XX:+UseZGC -XX:MaxRAMPercentage=75 --enable-native-access=ALL-UNNAMED"
# keep DJL fully offline at runtime
ENV AI_DJL_OFFLINE=true

# app jar and vendored natives
COPY --from=build /app/target/*.jar /app/app.jar
COPY --from=build /ext /app/ext

EXPOSE 8082

# Start Spring Boot and include vendored jars on classpath.
ENTRYPOINT ["sh","-lc","exec java $JAVA_OPTS -cp /app/app.jar:/app/ext/* org.springframework.boot.loader.launch.JarLauncher"]
