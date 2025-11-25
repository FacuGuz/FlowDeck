package microservices.auth.oauth;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class OAuthStateStore {

    private record StateEntry(String codeVerifier, Instant createdAt) {
    }

    private final Map<String, StateEntry> stateCache = new ConcurrentHashMap<>();
    private final long ttlSeconds;

    public OAuthStateStore(long ttlSeconds) {
        this.ttlSeconds = ttlSeconds;
    }

    public String save(String codeVerifier) {
        String state = UUID.randomUUID().toString();
        stateCache.put(state, new StateEntry(codeVerifier, Instant.now()));
        evictExpired();
        return state;
    }

    public Optional<String> consume(String state) {
        if (state == null) {
            return Optional.empty();
        }
        StateEntry entry = stateCache.remove(state);
        if (entry == null) {
            return Optional.empty();
        }
        if (entry.createdAt.plusSeconds(ttlSeconds).isBefore(Instant.now())) {
            return Optional.empty();
        }
        return Optional.of(entry.codeVerifier);
    }

    private void evictExpired() {
        Instant now = Instant.now();
        stateCache.entrySet().removeIf(e -> e.getValue().createdAt.plusSeconds(ttlSeconds).isBefore(now));
    }
}
