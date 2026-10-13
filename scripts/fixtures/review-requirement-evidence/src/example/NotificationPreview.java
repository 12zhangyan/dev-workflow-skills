package example;

import java.util.Objects;
import java.util.function.Consumer;

public final class NotificationPreview {
    private final Consumer<Boolean> notifier;

    public NotificationPreview(Consumer<Boolean> notifier) {
        this.notifier = Objects.requireNonNull(notifier, "notifier");
    }

    public boolean submit(int available, int requested) {
        if (available < 0 || requested <= 0) {
            throw new IllegalArgumentException("invalid input");
        }
        boolean accepted = requested <= available;
        notifier.accept(accepted);
        return accepted;
    }
}
