package com.example.weather.security;

import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Base64;
import java.util.Date;

@Service
public class JwtService {

    private final SecretKey signingKey;
    private final JwtParser parser;
    private final long expirationMs;

    public JwtService(@Value("${jwt.secret:}") String secret,
                      @Value("${jwt.expiration-ms}") long expirationMs) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalArgumentException("JWT signing key (jwt.secret / JWT_SECRET) must be configured");
        }
        byte[] keyBytes;
        try {
            keyBytes = Base64.getDecoder().decode(secret);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("JWT signing key must be valid Base64");
        }
        if (keyBytes.length < 32) {
            throw new IllegalArgumentException("JWT signing key must contain at least 256 decoded bits");
        }
        signingKey = Keys.hmacShaKeyFor(keyBytes);
        parser = Jwts.parser().verifyWith(signingKey)
                .sig().clear().add(Jwts.SIG.HS256).and().build();
        this.expirationMs = expirationMs;
    }

    public String generateToken(String email) {
        Date now = new Date();
        return Jwts.builder().subject(email).issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMs))
                .signWith(signingKey, Jwts.SIG.HS256).compact();
    }

    public String extractEmail(String token) {
        String email = parser.parseSignedClaims(token).getPayload().getSubject();
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("JWT subject is required");
        }
        return email;
    }
}
