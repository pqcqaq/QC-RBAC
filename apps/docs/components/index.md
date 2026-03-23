---
title: 内置组件
description: QC-RBAC 当前已经沉淀出来的可复用组件文档。
---

## 说明

这里记录项目内部已经稳定下来的组件抽象，重点写三类信息：

- 适用场景
- 参数、插槽、事件
- 与后端或共享协议的配套约定

## 当前组件

### Web

- [RelationSelectFormItem](/components/web/relation-select-form-item)
- [ImageSelectFormItem](/components/web/image-select-form-item)

## 使用约定

- 文档只记录已经在项目里落地并复用的组件。
- 组件文档必须和真实源码保持一致，参数名、插槽名、事件名都以源码为准。
- 如果组件依赖后端约定或共享类型，必须把配套协议一起写清楚，不只写 UI 用法。
