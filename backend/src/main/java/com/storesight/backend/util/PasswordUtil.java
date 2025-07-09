package com.storesight.backend.util;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * Utility class for password operations. This is primarily used for generating BCrypt hashes for
 * admin passwords.
 */
public class PasswordUtil {

  private static final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);

  /**
   * Generate a BCrypt hash for a plain text password. Use this to generate the hashed password for
   * the ADMIN_PASSWORD environment variable.
   *
   * @param plainPassword The plain text password
   * @return The BCrypt hash
   */
  public static String hashPassword(String plainPassword) {
    return encoder.encode(plainPassword);
  }

  /**
   * Verify if a plain text password matches a BCrypt hash.
   *
   * @param plainPassword The plain text password
   * @param hashedPassword The BCrypt hash
   * @return true if the password matches the hash
   */
  public static boolean verifyPassword(String plainPassword, String hashedPassword) {
    return encoder.matches(plainPassword, hashedPassword);
  }

  /**
   * Main method to generate a hash for admin password setup and test verification. Usage: java
   * PasswordUtil <plain-password> [hash-to-verify]
   */
  public static void main(String[] args) {
    if (args.length == 0) {
      System.out.println("Usage: java PasswordUtil <plain-password> [hash-to-verify]");
      System.out.println("  - With 1 arg: Generate BCrypt hash for password");
      System.out.println("  - With 2 args: Verify password against hash");
      return;
    }

    String plainPassword = args[0];

    if (args.length == 1) {
      // Generate hash
      String hash = hashPassword(plainPassword);
      System.out.println("Plain password: " + plainPassword);
      System.out.println("BCrypt hash: " + hash);
    } else if (args.length == 2) {
      // Verify password against hash
      String providedHash = args[1];
      boolean matches = verifyPassword(plainPassword, providedHash);

      System.out.println("Plain password: " + plainPassword);
      System.out.println("Provided hash: " + providedHash);
      System.out.println("Password matches: " + matches);

      if (matches) {
        System.out.println("✅ SUCCESS: Password verification passed!");
      } else {
        System.out.println("❌ FAILED: Password does not match the hash");

        // Generate correct hash for comparison
        String correctHash = hashPassword(plainPassword);
        System.out.println("Correct hash would be: " + correctHash);
      }
    }
  }
}
