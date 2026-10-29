import { DataTypes, Model, type Sequelize } from "sequelize";

export class ServiceModel extends Model {
  declare id: string;
  declare name: string;
}

export class AlertModel extends Model {
  declare id: string;
  declare serviceId: string;
  declare title: string;
  declare severity: string;
  declare status: string;
  declare firedAt: string;
  declare resolvedAt: string | null;
}

export class IncidentModel extends Model {
  declare seq: number;
  declare title: string;
  declare serviceId: string;
  declare severity: string;
  declare state: string;
  declare openedAt: string;
  declare resolvedAt: string | null;
}

export function defineModels(sequelize: Sequelize) {
  ServiceModel.init(
    { id: { type: DataTypes.STRING, primaryKey: true }, name: { type: DataTypes.STRING, allowNull: false, unique: true } },
    { sequelize, tableName: "services", timestamps: false },
  );
  AlertModel.init(
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      serviceId: { type: DataTypes.STRING, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      severity: { type: DataTypes.STRING, allowNull: false },
      status: { type: DataTypes.STRING, allowNull: false },
      firedAt: { type: DataTypes.STRING, allowNull: false },
      resolvedAt: { type: DataTypes.STRING, allowNull: true },
    },
    { sequelize, tableName: "alerts", timestamps: false },
  );
  IncidentModel.init(
    {
      seq: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: DataTypes.STRING, allowNull: false },
      serviceId: { type: DataTypes.STRING, allowNull: false },
      severity: { type: DataTypes.STRING, allowNull: false },
      state: { type: DataTypes.STRING, allowNull: false },
      openedAt: { type: DataTypes.STRING, allowNull: false },
      resolvedAt: { type: DataTypes.STRING, allowNull: true },
    },
    { sequelize, tableName: "incidents", timestamps: false },
  );
}
