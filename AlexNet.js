function AlexNet() {

    // /////////////////////////////////////////////////////////////////////////////
    //                       ///////    Variables    ///////
    // /////////////////////////////////////////////////////////////////////////////

    var w = window.innerWidth;
    var h = window.innerHeight;

    var color1 = '#eeeeee';
    var color2 = '#99ddff';
    var color3 = '#ffbbbb';

    var rectOpacity = 0.4;
    var filterOpacity = 0.4;
    var fontScale = 1;

    var line_material = new THREE.LineBasicMaterial({ color: 0x000000 });
    var box_material = new THREE.MeshBasicMaterial({
        color: color1,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: rectOpacity,
        depthWrite: false,
        needsUpdate: true
    });
    var conv_material = new THREE.MeshBasicMaterial({
        color: color2,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: filterOpacity,
        depthWrite: false,
        needsUpdate: true
    });
    var pyra_material = new THREE.MeshBasicMaterial({
        color: color3,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: filterOpacity,
        depthWrite: false,
        needsUpdate: true
    });

    var architecture = [];
    var architecture2 = [];
    var betweenLayers = 20;

    var logDepth = true;
    var depthScale = 10;
    var logWidth = true;
    var widthScale = 10;
    var logConvSize = false;
    var convScale = 1;

    var showDims = false;
    var showConvDims = false;

    let depthFn = (depth) => (logDepth ? Math.log(depth) * depthScale : depth * depthScale);
    let widthFn = (width) => (logWidth ? Math.log(width) * widthScale : width * widthScale);
    let convFn = (conv) => (logConvSize ? Math.log(conv) * convScale : conv * convScale);

    function wf(layer) { return widthFn(layer['width']); }
    function hf(layer) { return widthFn(layer['height']); }

    var layers = new THREE.Group();
    var convs = new THREE.Group();
    var pyramids = new THREE.Group();
    var sprites = new THREE.Group();

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    var camera = new THREE.OrthographicCamera(w / -2, w / 2, h / 2, h / -2, -10000000, 10000000);
    camera.position.set(-219, 92, 84);

    var renderer;
    var rendererType = 'webgl';

    var controls;

    // /////////////////////////////////////////////////////////////////////////////
    //                       ///////    Methods    ///////
    // /////////////////////////////////////////////////////////////////////////////

    function restartRenderer({ rendererType_ = rendererType } = {}) {

        rendererType = rendererType_;

        clearThree(scene);

        renderer = rendererType === 'webgl' ? new THREE.WebGLRenderer({ alpha: true }) : new THREE.SVGRenderer();
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.setSize(window.innerWidth, window.innerHeight);

        graph_container = document.getElementById('graph-container');
        while (graph_container.firstChild) {
            graph_container.removeChild(graph_container.firstChild);
        }
        graph_container.appendChild(renderer.domElement);

        if (controls) { controls.dispose(); }
        controls = new THREE.OrbitControls(camera, renderer.domElement);

        animate();
    }

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }

    restartRenderer();

    function redraw({ architecture_ = architecture, architecture2_ = architecture2, betweenLayers_ = betweenLayers, logDepth_ = logDepth, depthScale_ = depthScale, logWidth_ = logWidth, widthScale_ = widthScale, logConvSize_ = logConvSize, convScale_ = convScale, showDims_ = showDims, showConvDims_ = showConvDims } = {}) {

        architecture = architecture_;
        architecture2 = architecture2_;
        betweenLayers = betweenLayers_;
        logDepth = logDepth_;
        depthScale = depthScale_;
        logWidth = logWidth_;
        widthScale = widthScale_;
        logConvSize = logConvSize_;
        convScale = convScale_;
        showDims = showDims_;
        showConvDims = showConvDims_;

        clearThree(scene);

        var z_offset = -(sum(architecture.map(layer => depthFn(layer['depth']))) + (betweenLayers * (architecture.length - 1))) / 3;
        var layer_offsets = pairWise(architecture).reduce((offsets, layers) => offsets.concat([offsets.last() + depthFn(layers[0]['depth']) / 2 + betweenLayers + depthFn(layers[1]['depth']) / 2]), [z_offset]);
        layer_offsets = layer_offsets.concat(architecture2.reduce((offsets, layer) => offsets.concat([offsets.last() + widthFn(2) + betweenLayers]), [layer_offsets.last() + depthFn(architecture.last()['depth']) / 2 + betweenLayers + widthFn(2)]));

        architecture.forEach(function (layer, index) {

            // Layer
            var layer_geometry = new THREE.BoxGeometry(wf(layer), hf(layer), depthFn(layer['depth']));
            var layer_object = new THREE.Mesh(layer_geometry, box_material);
            layer_object.position.set(0, 0, layer_offsets[index]);
            layers.add(layer_object);

            var layer_edges_geometry = new THREE.EdgesGeometry(layer_geometry);
            var layer_edges_object = new THREE.LineSegments(layer_edges_geometry, line_material);
            layer_edges_object.position.set(0, 0, layer_offsets[index]);
            layers.add(layer_edges_object);

            if (index < architecture.length - 1) {

                // Conv
                var conv_geometry = new THREE.BoxGeometry(convFn(layer['filterWidth']), convFn(layer['filterHeight']), depthFn(layer['depth']));
                var conv_object = new THREE.Mesh(conv_geometry, conv_material);
                conv_object.position.set(layer['rel_x'] * wf(layer), layer['rel_y'] * hf(layer), layer_offsets[index]);
                convs.add(conv_object);

                var conv_edges_geometry = new THREE.EdgesGeometry(conv_geometry);
                var conv_edges_object = new THREE.LineSegments(conv_edges_geometry, line_material);
                conv_edges_object.position.set(layer['rel_x'] * wf(layer), layer['rel_y'] * hf(layer), layer_offsets[index]);
                convs.add(conv_edges_object);

                // Pyramid
                var pyramid_geometry = new THREE.Geometry();
                var base_z = layer_offsets[index] + (depthFn(layer['depth']) / 2);
                var summit_z = base_z + betweenLayers;
                var next_layer_wh = widthFn(architecture[index + 1]['width']);

                pyramid_geometry.vertices = [
                    new THREE.Vector3((layer['rel_x'] * wf(layer)) + (convFn(layer['filterWidth']) / 2), (layer['rel_y'] * hf(layer)) + (convFn(layer['filterHeight']) / 2), base_z),
                    new THREE.Vector3((layer['rel_x'] * wf(layer)) + (convFn(layer['filterWidth']) / 2), (layer['rel_y'] * hf(layer)) - (convFn(layer['filterHeight']) / 2), base_z),
                    new THREE.Vector3((layer['rel_x'] * wf(layer)) - (convFn(layer['filterWidth']) / 2), (layer['rel_y'] * hf(layer)) - (convFn(layer['filterHeight']) / 2), base_z),
                    new THREE.Vector3((layer['rel_x'] * wf(layer)) - (convFn(layer['filterWidth']) / 2), (layer['rel_y'] * hf(layer)) + (convFn(layer['filterHeight']) / 2), base_z),
                    new THREE.Vector3((layer['rel_x'] * next_layer_wh), (layer['rel_y'] * next_layer_wh), summit_z)
                ];
                pyramid_geometry.faces = [
                    new THREE.Face3(0, 1, 2),
                    new THREE.Face3(0, 2, 3),
                    new THREE.Face3(1, 0, 4),
                    new THREE.Face3(2, 1, 4),
                    new THREE.Face3(3, 2, 4),
                    new THREE.Face3(0, 3, 4)
                ];

                var pyramid_object = new THREE.Mesh(pyramid_geometry, pyra_material);
                pyramids.add(pyramid_object);

                var pyramid_edges_geometry = new THREE.EdgesGeometry(pyramid_geometry);
                var pyramid_edges_object = new THREE.LineSegments(pyramid_edges_geometry, line_material);
                pyramids.add(pyramid_edges_object);
            }

            if (showDims) {
                // Dims
                var sprite = makeTextSprite(layer['depth'].toString());
                sprite.position.copy(layer_object.position).sub(new THREE.Vector3(wf(layer) / 2 + 2, hf(layer) / 2 + 2, 0));
                sprites.add(sprite);

                sprite = makeTextSprite(layer['height'].toString());
                sprite.position.copy(layer_object.position).sub(new THREE.Vector3(wf(layer) / 2 + 3, 0, depthFn(layer['depth']) / 2));
                sprites.add(sprite);

                sprite = makeTextSprite(layer['width'].toString());
                sprite.position.copy(layer_object.position).add(new THREE.Vector3(wf(layer) / 2 + 2, 0, depthFn(layer['depth']) / 2));
                sprites.add(sprite);
            }
        });

        scene.add(layers);
        scene.add(convs);
        scene.add(pyramids);
        scene.add(sprites);
    }

    function clearThree(scene) {
        while (scene.children.length > 0) {
            const object = scene.children[0];
            scene.remove(object);
        }
    }

    // Utility functions
    function sum(array) {
        return array.reduce((a, b) => a + b, 0);
    }

    function pairWise(array) {
        return array.reduce((result, item, index) => {
            if (index === array.length - 1) return result;
            return result.concat([[item, array[index + 1]]]);
        }, []);
    }

    function makeTextSprite(message, color = { r: 0, g: 0, b: 0 }) {
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        context.font = '36px Arial';
        context.fillStyle = "rgba(" + color.r + ", " + color.g + ", " + color.b + ", 1)";
        context.fillText(message, 0, 40);
        var texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        var spriteMaterial = new THREE.SpriteMaterial({ map: texture, useScreenCoordinates: true, depthTest: false });
        var sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(100, 50, 1.0);
        return sprite;
    }

    return { redraw, restartRenderer };
}
