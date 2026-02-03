FROM cgr.dev/chainguard-private/maven:3.9.12-jdk17-dev AS build

ARG MAVEN_USERNAME
ARG MAVEN_PASSWORD

WORKDIR /app

# Setup Maven settings with credentials
RUN mkdir -p /home/nonroot/.m2
COPY settings-registry2.xml /app/settings-template.xml
RUN sed "s|\${env.MAVEN_USERNAME}|${MAVEN_USERNAME}|g" /app/settings-template.xml | \
    sed "s|\${env.MAVEN_PASSWORD}|${MAVEN_PASSWORD}|g" > /home/nonroot/.m2/settings.xml && \
    rm /app/settings-template.xml

# Download dependencies
COPY pom.xml .
RUN mvn -s /home/nonroot/.m2/settings.xml dependency:go-offline

# Build application
COPY src ./src
RUN mvn -s /home/nonroot/.m2/settings.xml clean package -DskipTests

# Runtime stage
FROM cgr.dev/chainguard-private/jre:openjdk-17-dev
# Install chainctl as root
USER root
RUN apk add --no-cache chainctl
USER nonroot
WORKDIR /app

# Copy the built jar from build stage
COPY --from=build /app/target/*.jar app.jar

# Expose port
EXPOSE 8080

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
