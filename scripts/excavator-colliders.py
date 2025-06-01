import bpy
import bmesh
from mathutils import Vector, Matrix
import math

JAW_ROTATION_TYPE = {
    'jaw-1': 'YZ_PLANE',
    'jaw-2': 'XZ_PLANE',
    'jaw-3': 'XZ_PLANE',
    'jaw-4': 'YZ_PLANE'
}

def calculate_face_dimensions(vertices):
    edge_lengths = []
    for i in range(len(vertices)):
        next_i = (i + 1) % len(vertices)
        edge_length = (vertices[next_i] - vertices[i]).length
        edge_lengths.append(edge_length)
    if len(edge_lengths) == 4:
        pair1_avg = (edge_lengths[0] + edge_lengths[2]) / 2.0
        pair2_avg = (edge_lengths[1] + edge_lengths[3]) / 2.0
        edge1_dir = (vertices[1] - vertices[0]).normalized()
        edge2_dir = (vertices[2] - vertices[1]).normalized()
        x_axis = Vector((1, 0, 0))
        edge1_x_alignment = abs(edge1_dir.dot(x_axis))
        edge2_x_alignment = abs(edge2_dir.dot(x_axis))
        if edge1_x_alignment > edge2_x_alignment:
            width = pair1_avg
            height = pair2_avg
        else:
            width = pair2_avg
            height = pair1_avg
    return width, height, edge_lengths

def get_data_from_selected_faces():
    selected_objects = [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']
    objects_data = {}
    coord_transform = Matrix((
        (1,  0,  0),
        (0,  0,  1),
        (0, -1,  0)
    ))
    for obj in selected_objects:
        rotation_type = JAW_ROTATION_TYPE.get(obj.name, 'XZ_PLANE')
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode='EDIT')
        bm = bmesh.from_edit_mesh(obj.data)
        bm.faces.ensure_lookup_table()
        data = []
        world_matrix = obj.matrix_world
        for face in bm.faces:
            if face.select and len(face.verts) == 4:
                verts_local = [v.co for v in face.verts]
                verts_world = [world_matrix @ v for v in verts_local]
                center_world = sum(verts_world, Vector()) / len(verts_world)
                normal_local = face.normal.copy()
                normal_world = world_matrix.to_3x3() @ normal_local
                normal_world.normalize()
                center = coord_transform @ center_world
                normal = coord_transform @ normal_world
                target_normal = normal.normalized()
                if rotation_type == 'YZ_PLANE':
                    rotation_x = math.atan2(target_normal.y, target_normal.z)
                    rotation_y = math.atan2(-target_normal.x, math.sqrt(target_normal.y * target_normal.y + target_normal.z * target_normal.z))
                    rotation_z = 0
                elif rotation_type == 'XZ_PLANE':
                    base_rotation_x = math.atan2(target_normal.z, target_normal.y)
                    rotation_x = base_rotation_x + math.pi / 2
                    rotation_y = 0
                    rotation_z = math.atan2(-target_normal.x, math.sqrt(target_normal.y * target_normal.y + target_normal.z * target_normal.z))
                rotation = (rotation_x, rotation_y, rotation_z)
                vertices = [coord_transform @ v for v in verts_world]
                width, height, edge_lengths = calculate_face_dimensions(vertices)
                x_coords = [v.x for v in vertices]
                y_coords = [v.y for v in vertices]
                z_coords = [v.z for v in vertices]
                x_extent = max(x_coords) - min(x_coords)
                y_extent = max(y_coords) - min(y_coords)
                z_extent = max(z_coords) - min(z_coords)
                data.append({
                    'position': center,
                    'normal': normal,
                    'rotation': rotation,
                    'width': width,
                    'height': height
                })
        bmesh.update_edit_mesh(obj.data)
        bpy.ops.object.mode_set(mode='OBJECT')
        objects_data[obj.name] = data
    return objects_data

def copy_to_clipboard(text):
    bpy.context.window_manager.clipboard = text

def generate_colliders():
    objects_data = get_data_from_selected_faces()
    if not objects_data:
        print("No quads found in selected objects")
        return
    js_code = f"// Generated colliders from Blender (see /scripts/excavator-colliders.py)\n\n"
    js_code += "const COLLIDERS = {};\n"
    for obj_name, data in objects_data.items():
        js_code += f"COLLIDERS['{obj_name}'] = [\n"
        for i, trap in enumerate(data):
            pos = trap['position']
            normal = trap['normal']
            rot = trap['rotation']
            width = trap['width']
            height = trap['height']
            js_code += f"    {{\n"
            js_code += f"        position: [{pos.x}, {pos.y}, {pos.z}],\n"
            js_code += f"        normal: [{normal.x}, {normal.y}, {normal.z}],\n"
            js_code += f"        rotation: [{rot[0]}, {rot[1]}, {rot[2]}],\n"
            js_code += f"        width: {width},\n"
            js_code += f"        height: {height}\n"
            js_code += f"    }}" + ("," if i < len(data) - 1 else "") + "\n"
        js_code += "];\n\n"
    js_code += "export default COLLIDERS;"
    copy_to_clipboard(js_code)

if __name__ == "__main__":
    generate_colliders()