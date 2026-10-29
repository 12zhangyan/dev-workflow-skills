package com.acme.ticket;

import java.time.LocalDateTime;

public final class Ticket {
    private final long id;
    private final long deptId;
    private final Long handlerId;
    private final TicketStatus status;
    private final LocalDateTime createdAt;
    private final LocalDateTime assignedAt;
    private final boolean deleted;

    public Ticket(long id, long deptId, Long handlerId, TicketStatus status,
                  LocalDateTime createdAt, LocalDateTime assignedAt, boolean deleted) {
        this.id = id;
        this.deptId = deptId;
        this.handlerId = handlerId;
        this.status = status;
        this.createdAt = createdAt;
        this.assignedAt = assignedAt;
        this.deleted = deleted;
    }

    public long getId() { return id; }
    public long getDeptId() { return deptId; }
    public Long getHandlerId() { return handlerId; }
    public TicketStatus getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getAssignedAt() { return assignedAt; }
    public boolean isDeleted() { return deleted; }
}
