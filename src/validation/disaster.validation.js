export const createDisasterSchema = Joi.object({
  title: Joi.string().required().min(3).max(200),
  location_name: Joi.string().optional().max(500),
  latitude: Joi.number().optional().min(-90).max(90),
  longitude: Joi.number().optional().min(-180).max(180),
  description: Joi.string().optional().max(2000),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  owner_id: Joi.string().required().min(1).max(100),
});

export const updateDisasterSchema = Joi.object({
  title: Joi.string().optional().min(3).max(200),
  location_name: Joi.string().optional().max(500),
  latitude: Joi.number().optional().min(-90).max(90),
  longitude: Joi.number().optional().min(-180).max(180),
  description: Joi.string().optional().max(2000),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
});

export const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  owner_id: Joi.string().optional(),
  tags: Joi.string().optional(), // comma-separated tags
  search: Joi.string().optional().max(200),
  lat: Joi.number().optional().min(-90).max(90),
  lng: Joi.number().optional().min(-180).max(180),
  radius: Joi.number().optional().min(100).max(100000).default(50000), // meters
});
