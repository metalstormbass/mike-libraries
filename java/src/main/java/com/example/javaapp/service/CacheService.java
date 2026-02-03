package com.example.javaapp.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class CacheService {

    @Autowired(required = false)
    private StringRedisTemplate redisTemplate;

    public void set(String key, String value) {
        if (redisTemplate != null) {
            redisTemplate.opsForValue().set(key, value);
        }
    }

    public String get(String key) {
        if (redisTemplate != null) {
            return redisTemplate.opsForValue().get(key);
        }
        return null;
    }
}
