package com.company.accounting.domain.accounting.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "journal_entries")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JournalEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    @Column(nullable = false)
    private String description;

    @Column(name = "reference_number")
    private String referenceNumber; // e.g., Invoice Number or PO Number

    @OneToMany(mappedBy = "journalEntry", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<JournalEntryLine> lines = new ArrayList<>();

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    public void addLine(JournalEntryLine line) {
        lines.add(line);
        line.setJournalEntry(this);
    }
}
