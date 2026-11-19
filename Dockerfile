# ---------- build ----------
FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src/main ./src/main
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp -DskipTests package

# ---------- run ----------
FROM eclipse-temurin:17-jre
WORKDIR /app
RUN curl --version
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
