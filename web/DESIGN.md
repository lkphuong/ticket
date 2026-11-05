---
name: VTDesk
description: Nền tảng điều phối dịch vụ và quản trị yêu cầu liên phòng ban cấp doanh nghiệp. Giao diện sáng với các thẻ bề mặt trắng trên nền xám lạnh, màu cam gạch nhấn mạnh hành động, và dải nhận diện vai trò nghiệp vụ (nhân viên, trưởng phòng, ban lãnh đạo điều hành).
colors:
  canvas: "#f3f5f8"
  surface: "#ffffff"
  ink: "#16202e"
  ink-muted: "#556073"
  line: "#e2e7ee"
  line-strong: "#c3ccd8"
  accent-600: "#d4501a"
  accent-700: "#b04014"
  blue-700: "#1d4ea0"
  sea-700: "#0b6b63"
  ochre-500: "#d19a14"
  brick-500: "#c0173a"
  moss-700: "#1f6b3f"
  mine-600: "#6a3fa3"
typography:
  headline:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
  body:
    fontFamily: "Be Vietnam Pro, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
rounded:
  chip: "6px"
  control: "6px"
  panel: "8px"
---

# Design System: VTDesk

## Overview

**Creative North Star: "The Enterprise Dispatch Board"**

A light, quiet work surface: white panels on a cool grey canvas, hairline borders, a single burnt-orange action colour. The home page changes with the viewer's role: staff see what waits on them and their department queue; department heads add a status strip for their department, the unassigned list and overdue tickets; executives see company-wide counts, load per department and overdue tickets.

The header has a 4px stripe in the role colour (staff blue, head teal, executive ink). Violet stays reserved for work waiting on the viewer. Each department is an icon on a solid colour next to its name. Icons are small outline SVGs (sun and moon for the theme, one per department, a person for avatars), always paired with a text label.
