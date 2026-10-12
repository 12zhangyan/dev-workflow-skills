public final class OrderServiceTest {
    interface Mapper { long count(String tenantId, String state); }
    static final class Service {
        private final Mapper mapper;
        Service(Mapper mapper) { this.mapper = mapper; }
        long total(String tenantId, String state) { return mapper.count(tenantId, state); }
    }
    public static void main(String[] args) {
        final String[] observed = new String[2];
        Service service = new Service((tenant, state) -> {
            observed[0] = tenant;
            observed[1] = state;
            return 2L;
        });
        if (service.total("TENANT_A", "OPEN") != 2L) throw new AssertionError("total");
        if (!"TENANT_A".equals(observed[0]) || !"OPEN".equals(observed[1])) {
            throw new AssertionError("parameters");
        }
    }
}
