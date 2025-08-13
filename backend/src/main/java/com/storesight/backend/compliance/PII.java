package com.storesight.backend.compliance;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Marks a field as containing PII. Used by inventory scanners and masking. */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.FIELD})
public @interface PII {
  PIICategory value() default PIICategory.OTHER;
}
