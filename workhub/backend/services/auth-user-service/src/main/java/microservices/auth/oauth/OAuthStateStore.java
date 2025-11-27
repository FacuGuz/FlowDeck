package microservices.auth.oauth;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class OAuthStateStore {

    public record StateData(String codeVerifier, String meta) {
    }

    private record StateEntry(String codeVerifier, String meta, Instant createdAt) {
    }

    private final Map<String, StateEntry> stateCache = new ConcurrentHashMap<>();
    private final long ttlSeconds;

    public OAuthStateStore(long ttlSeconds) {
        this.ttlSeconds = ttlSeconds;
    }

    public String save(String codeVerifier) {
        return save(codeVerifier, null);
    }

    public String save(String codeVerifier, String meta) {
        String state = UUID.randomUUID().toString();
        stateCache.put(state, new StateEntry(codeVerifier, meta, Instant.now()));
        evictExpired();
        return state;
    }

    public Optional<StateData> consume(String state) {
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
        return Optional.of(new StateData(entry.codeVerifier, entry.meta));
    }

    private void evictExpired() {
        Instant now = Instant.now();
        stateCache.entrySet().removeIf(e -> e.getValue().createdAt.plusSeconds(ttlSeconds).isBefore(now));
    }
}
