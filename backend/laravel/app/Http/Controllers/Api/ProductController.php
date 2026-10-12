<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    // Get all products (for Shopper, Inventory Worker, and Supervisor catalogs)
    public function index()
    {
        return response()->json([
            'success' => true,
            'data' => Product::all()
        ], 200);
    }

    // Store a new product with validation rules (Used by Supervisor)
    public function store(Request $request)
    {
        // Map frontend 'price' to database 'selling_price' if needed
        if ($request->has('price') && !$request->has('selling_price')) {
            $request->merge(['selling_price' => $request->input('price')]);
        }

        // Auto-assign base_cost if missing from form modal
        if (!$request->has('base_cost') || empty($request->input('base_cost'))) {
            $request->merge(['base_cost' => ($request->input('selling_price') ?? 0) * 0.8]);
        }


        $validatedData = $request->validate([
            'name' => 'required|string|max:255',
            'sku' => 'required|string|unique:products,sku',
            'barcode' => 'nullable|string',
            'size' => 'nullable|string',
            'category' => 'required|string',
            'base_cost' => 'required|numeric|min:0',
            'selling_price' => 'required|numeric|min:0',
            'stock_quantity' => 'required|integer|min:0',
            'status' => 'required|string',
        ]);

        $product = Product::create($validatedData);

        return response()->json([
            'success' => true,
            'message' => 'Product created successfully',
            'data' => $product
        ], 201);
    }

    // Update an existing product with validation rules
    public function update(Request $request, $id)
    {
        $product = Product::findOrFail($id);

        $validatedData = $request->validate([
            'name' => 'required|string|max:255',
            'sku' => 'required|string|unique:products,sku,' . $id . ',product_id',
            'barcode' => 'nullable|string',
            'size' => 'nullable|string',
            'category' => 'required|string',
            'base_cost' => 'required|numeric|min:0',
            'selling_price' => 'required|numeric|min:0',
            'stock_quantity' => 'required|integer|min:0',
            'status' => 'required|string',
        ]);

        $product->update($validatedData);

        return response()->json([
            'success' => true,
            'message' => 'Product updated successfully',
            'data' => $product
        ], 200);
    }
}