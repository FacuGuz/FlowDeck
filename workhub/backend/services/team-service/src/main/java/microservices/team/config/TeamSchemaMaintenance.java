package microservices.team.config;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
public class TeamSchemaMaintenance {

    private static final Logger log = LoggerFactory.getLogger(TeamSchemaMaintenance.class);

    private static final String UNIQUE_CONSTRAINT_QUERY = """
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
                     JOIN information_schema.constraint_column_usage ccu
                          ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_name = 'teams'
              AND tc.constraint_type = 'UNIQUE'
              AND ccu.column_name = 'name'
            """;

    @Bean
    ApplicationRunner dropLegacyUniqueConstraint(JdbcTemplate jdbcTemplate) {
        return args -> {
            List<String> constraints = jdbcTemplate.queryForList(UNIQUE_CONSTRAINT_QUERY, String.class);
            for (String constraintName : constraints) {
                String sql = "ALTER TABLE teams DROP CONSTRAINT " + quoteIdentifier(constraintName);
                log.info("Dropping legacy unique constraint {}", constraintName);
                jdbcTemplate.execute(sql);
            }
        };
    }

    private String quoteIdentifier(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }
}
