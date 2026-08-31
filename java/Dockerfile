FROM cgr.dev/mikeco.com/jdk:17-dev AS build

USER root
RUN apk add --no-cache maven

ARG MAVEN_USERNAME
ARG MAVEN_PASSWORD
ARG SETTINGS_FILE=settings.xml
ARG SPRING_BOOT_VERSION=3.2.1
ARG MAVEN_EXTRA_ARGS=""
ENV MAVEN_USERNAME=${MAVEN_USERNAME} \
    MAVEN_PASSWORD=${MAVEN_PASSWORD}

WORKDIR /app

COPY ${SETTINGS_FILE} /root/.m2/settings.xml

COPY pom.xml .
COPY src ./src
RUN mvn -s /root/.m2/settings.xml \
    -Dspring-boot.version=${SPRING_BOOT_VERSION} \
    ${MAVEN_EXTRA_ARGS} \
    package -DskipTests

FROM cgr.dev/mikeco.com/jre:17
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
