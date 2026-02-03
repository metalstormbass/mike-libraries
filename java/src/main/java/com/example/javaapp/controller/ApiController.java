package com.example.javaapp.controller;

import com.example.javaapp.model.Item;
import com.example.javaapp.service.CacheService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class ApiController {

    @Autowired
    private CacheService cacheService;

    @GetMapping(value = "/", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> home() {
        return dependencies();
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "healthy");
        response.put("service", "java-app");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/items")
    public ResponseEntity<Map<String, List<Item>>> getItems() {
        List<Item> items = new ArrayList<>();
        items.add(new Item(1L, "Item 1", "Description 1"));
        items.add(new Item(2L, "Item 2", "Description 2"));

        Map<String, List<Item>> response = new HashMap<>();
        response.put("items", items);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/items")
    public ResponseEntity<Map<String, Object>> createItem(@RequestBody Item item) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Item created");
        response.put("item", item);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/cache/{key}")
    public ResponseEntity<Map<String, String>> getCache(@PathVariable String key) {
        String value = cacheService.get(key);
        Map<String, String> response = new HashMap<>();
        response.put("key", key);
        response.put("value", value);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/cache/{key}")
    public ResponseEntity<Map<String, String>> setCache(@PathVariable String key, @RequestBody Map<String, String> body) {
        String value = body.get("value");
        cacheService.set(key, value);

        Map<String, String> response = new HashMap<>();
        response.put("message", "Cached " + key);
        return ResponseEntity.ok(response);
    }

    @GetMapping(value = "/dependencies", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> dependencies() {
        try {
            // Read pom.xml from classpath
            InputStream is = getClass().getClassLoader().getResourceAsStream("../../pom.xml");
            if (is == null) {
                // Try alternative path
                is = getClass().getResourceAsStream("/pom.xml");
            }

            List<String> dependencies = new ArrayList<>();
            List<String> starters = new ArrayList<>();

            // Parse for common dependencies
            starters.add("spring-boot-starter-web");
            starters.add("spring-boot-starter-data-jpa");
            starters.add("spring-boot-starter-data-redis");
            starters.add("spring-boot-starter-validation");
            starters.add("spring-boot-starter-actuator");
            starters.add("spring-boot-starter-security");
            starters.add("spring-boot-starter-cache");
            starters.add("spring-boot-starter-mail");

            dependencies.add("PostgreSQL Driver");
            dependencies.add("H2 Database");
            dependencies.add("Lombok");
            dependencies.add("Jackson Databind");
            dependencies.add("Commons Lang3");
            dependencies.add("Guava 32.1.3");
            dependencies.add("Commons IO 2.15.1");
            dependencies.add("ModelMapper 3.2.0");
            dependencies.add("JJWT API 0.12.3");
            dependencies.add("JJWT Implementation 0.12.3");
            dependencies.add("JJWT Jackson 0.12.3");
            dependencies.add("Apache HttpClient5");
            dependencies.add("Jackson JSR310");
            dependencies.add("SpringDoc OpenAPI 2.3.0");
            dependencies.add("Flyway Core");
            dependencies.add("OkHttp 4.12.0");
            dependencies.add("Commons Collections4 4.4");
            dependencies.add("Caffeine Cache");
            dependencies.add("MapStruct 1.5.5");
            dependencies.add("Hibernate Validator");
            dependencies.add("Spring Boot Test");

            StringBuilder html = new StringBuilder();
            html.append("<!DOCTYPE html>");
            html.append("<html><head><title>Java Dependencies</title>");
            html.append("<style>");
            html.append("body { font-family: Arial, sans-serif; max-width: 1200px; margin: 50px auto; padding: 20px; background-color: #f5f5f5; }");
            html.append("h1 { color: #5382A1; border-bottom: 3px solid #E76F00; padding-bottom: 10px; }");
            html.append(".info { background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }");
            html.append(".section { margin-bottom: 30px; }");
            html.append(".section-title { font-size: 20px; font-weight: bold; color: #E76F00; margin-bottom: 15px; }");
            html.append(".deps-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; }");
            html.append(".dep-card { background-color: white; padding: 15px; border-radius: 8px; border-left: 4px solid #5382A1; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }");
            html.append(".dep-card.starter { border-left-color: #E76F00; }");
            html.append(".dep-name { font-weight: bold; color: #5382A1; font-size: 16px; }");
            html.append(".count { color: #E76F00; font-weight: bold; font-size: 24px; }");
            html.append("</style></head><body>");

            html.append("<h1>☕ Java Spring Boot Application Dependencies</h1>");
            html.append("<div class='info'>");
            html.append("<p><strong>Framework:</strong> Spring Boot 3.2.1</p>");
            html.append("<p><strong>Java Version:</strong> 17</p>");
            html.append("<p><strong>Spring Starters:</strong> <span class='count'>").append(starters.size()).append("</span></p>");
            html.append("<p><strong>Other Dependencies:</strong> <span class='count'>").append(dependencies.size()).append("</span></p>");
            html.append("<p><strong>Build Tool:</strong> Maven</p>");
            html.append("</div>");

            html.append("<div class='section'>");
            html.append("<div class='section-title'>Spring Boot Starters</div>");
            html.append("<div class='deps-grid'>");
            for (String starter : starters) {
                html.append("<div class='dep-card starter'>");
                html.append("<div class='dep-name'>").append(starter).append("</div>");
                html.append("</div>");
            }
            html.append("</div></div>");

            html.append("<div class='section'>");
            html.append("<div class='section-title'>Additional Dependencies</div>");
            html.append("<div class='deps-grid'>");
            for (String dep : dependencies) {
                html.append("<div class='dep-card'>");
                html.append("<div class='dep-name'>").append(dep).append("</div>");
                html.append("</div>");
            }
            html.append("</div></div>");

            html.append("</body></html>");

            return ResponseEntity.ok(html.toString());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("<html><body><h1>Error loading dependencies</h1><p>" + e.getMessage() + "</p></body></html>");
        }
    }
}
