package com.example.javaapp;

import com.example.javaapp.controller.ApiController;
import com.example.javaapp.service.CacheService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

@WebMvcTest(ApiController.class)
public class ApiControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private CacheService cacheService;

    @Test
    public void testHome() throws Exception {
        mockMvc.perform(get("/api/"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Java Spring Boot Application"));
    }

    @Test
    public void testHealth() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("healthy"))
                .andExpect(jsonPath("$.service").value("java-app"));
    }

    @Test
    public void testGetItems() throws Exception {
        mockMvc.perform(get("/api/items"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());
    }
}
