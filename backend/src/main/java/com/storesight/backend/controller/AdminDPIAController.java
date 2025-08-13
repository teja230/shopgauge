package com.storesight.backend.controller;

import com.storesight.backend.model.DPIARecord;
import com.storesight.backend.repository.DPIARecordRepository;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/dpia")
@PreAuthorize("hasRole('ADMIN')")
public class AdminDPIAController {

  private final DPIARecordRepository repository;

  public AdminDPIAController(DPIARecordRepository repository) {
    this.repository = repository;
  }

  @GetMapping
  public ResponseEntity<List<DPIARecord>> list() {
    return ResponseEntity.ok(repository.findAll());
  }

  @PostMapping
  public ResponseEntity<DPIARecord> create(@RequestBody DPIARecord record) {
    return ResponseEntity.ok(repository.save(record));
  }
}
