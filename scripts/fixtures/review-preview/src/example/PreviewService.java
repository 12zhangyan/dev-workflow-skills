package example;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class PreviewService {
    public List<String> previewRows(List<String> source, int limit) {
        Objects.requireNonNull(source, "source");
        if (limit < 1 || limit > 50) {
            throw new IllegalArgumentException("limit must be between 1 and 50");
        }
        List<String> rows = new ArrayList<>(source);
        rows.removeIf(Objects::isNull);
        return firstRows(rows, limit);
    }

    private List<String> firstRows(List<String> rows, int limit) {
        int end = Math.min(limit - 1, rows.size());
        return new ArrayList<>(rows.subList(0, end));
    }
}
