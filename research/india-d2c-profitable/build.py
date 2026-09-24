"""Compile the top-100 profitable Indian D2C brands CSV from the research sheets.

Financials come from the research CSVs (filed / reported numbers with source URLs).
Customer figures are proxy estimates:
    consumer_spend  = revenue_cr * 1e7 * gross_up      (adds GST + channel margin)
    orders_per_year = consumer_spend / AOV
    unique_per_year = orders_per_year / purchase_frequency
    customers_per_month = unique_per_year * min(1, frequency / 12)
"""
import csv, glob, os, sys

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "top100_profitable_d2c_brands_india.csv")

research = {}
for f in glob.glob(os.path.join(HERE, "*.csv")):
    tag = os.path.basename(f)[:4]
    for r in csv.DictReader(open(f)):
        research[(tag, r["brand"])] = r

# gross-up presets: consumer rupees spent per rupee of brand revenue
DIG, OMNI, OFF, EXP = 1.15, 1.30, 1.45, 1.03

# (brand, parent/entity override, category, products, channel, fy, rev, pat, ebitda,
#  tier, status, confidence, aov, freq, gross_up, lookup keys, notes)
A = "A - Verified profitable"
B = "B - Profitable with caveat"
C = "C - Profit-adjacent (proxy)"

ROWS = [
 # ---------------- Tier A: filed/reported PAT > 0 in FY25 or FY26, digital-first ----------------
 ("Lenskart", "Lenskart Solutions Ltd (listed)", "Eyewear", "Prescription glasses, sunglasses, contact lenses, eye tests (Lenskart, John Jacobs, Vincent Chase, Owndays intl.)", "Omnichannel: app/web + ~2,700 own/franchise stores; ~40% revenue international", "FY26", 8814, 500.9, 1789.5, A, "PAT positive (reported 500.9; adjusted ~530)", "High", 3500, 1.3, 1.12, [("elec","Lenskart"),("fash","Lenskart")], "Operating revenue 8,814 Cr (total income ~9,002 Cr). Disclosed: 35.3 mn eyewear units sold & 23.8 mn eye tests in FY26; order estimate (~28 mn) assumes ~1.25 units/order."),
 ("Mamaearth (Honasa Consumer)", "Honasa Consumer Ltd (listed)", "Beauty & personal care", "Skincare, haircare, baby care - Mamaearth, The Derma Co, Aqualogica, Dr. Sheth's, BBlunt, Staze", "Omnichannel: own web/app, marketplaces, quick-commerce; ~1.2 lakh offline outlets billed", "FY26", 2392, 200.2, None, A, "PAT positive", "High", 450, 2.5, OMNI, [("beau","Mamaearth (Honasa portfolio)")], "Operating revenue 2,392 Cr (total income ~2,475 Cr). Profit up ~175% YoY. Includes Dr. Sheth's, The Derma Co, Aqualogica."),
 ("boAt", "Imagine Marketing Ltd", "Consumer electronics", "TWS earbuds, headphones, neckbands, speakers, smartwatches", "Marketplace-led (Amazon/Flipkart) + own site + offline; IPO-bound", "FY26", 2931, 84.5, None, A, "PAT positive", "Medium", 1400, 1.2, 1.25, [("elec","boAt")], "FY26 from secondary report; FY25 (DRHP): rev 3,098 Cr, PAT 60 Cr, EBITDA 142.5 Cr."),
 ("BlueStone", "BlueStone Jewellery & Lifestyle Ltd (listed)", "Fine jewellery", "Diamond, gold & platinum jewellery; engagement rings", "Omnichannel: web/app + ~300 stores", "FY26", 2436.4, 13.2, None, A, "PAT positive (first profitable year; FY25 loss 222 Cr)", "High", 40000, 1.15, EXP, [("elec","BlueStone"),("disc","BlueStone")], "Some Inc42 pieces cite PAT ~26 Cr. Operating profit reported ~388 Cr (Ind-AS 116 heavy - not a clean EBITDA)."),
 ("Wakefit", "Wakefit Innovations Ltd (listed)", "Mattresses & furniture", "Mattresses, pillows, beds, sofas, furniture, furnishings", "Omnichannel: own site ~ majority, marketplaces, 100+ stores", "FY26", 1489, 189, None, A, "PAT positive (incl. ~98 Cr deferred-tax credit)", "High", 10000, 1.05, DIG, [("elec","Wakefit")], "Total income ~1,534 Cr. Ex-DTA credit PAT would be ~90 Cr."),
 ("HealthKart", "Bright Lifecare Pvt Ltd", "Health & nutrition", "Sports nutrition & supplements - MuscleBlaze, HK Vitals, TrueBasics, Gritzo", "Own app/web + marketplaces + ~200 stores", "FY25", 1313, 120, 79, A, "PAT positive", "High", 2200, 3.0, 1.2, [("heal","HealthKart (MuscleBlaze, HK Vitals, TrueBasics, Gritzo)")], "EBITDA derived from ~6% margin reported by Entrackr."),
 ("Noise", "Nexxbase Marketing Pvt Ltd", "Consumer electronics", "Smartwatches, TWS earbuds, smart rings", "Marketplace-led + own site + offline", "FY25", 1048, 3.2, 18, A, "PAT positive (thin; aided by 47 Cr deferred-tax gain)", "High", 1800, 1.2, 1.25, [("elec","Noise")], "Operating profitability is thin; PAT positive only due to tax credit."),
 ("Rare Rabbit", "Radhamani Textiles Pvt Ltd", "Fashion & apparel", "Premium menswear & womenswear (Rare Rabbit, Rareism), accessories", "Omnichannel: ~150 stores + own site", "FY25", 818.67, 16, None, A, "PAT positive (down from ~70 Cr in FY24 on higher ad spend)", "High", 3500, 1.8, 1.12, [("fash","Rare Rabbit")], ""),
 ("GoBoult (Boult Audio)", "Boult (entity per filings)", "Consumer electronics", "TWS earbuds, headphones, smartwatches, car accessories", "Marketplace-led (Flipkart/Amazon); bootstrapped", "FY25", 763, 24, 50, A, "PAT positive", "High", 1200, 1.2, 1.2, [("elec","Boult (GoBoult)"),("disc","GoBoult (Boult Audio)")], "Unfunded/bootstrapped. EBITDA from ~6.6% margin."),
 ("Minimalist", "Uprising Science Pvt Ltd (90.5% HUL)", "Beauty & personal care", "Active-ingredient skincare - serums, sunscreens, moisturisers, haircare", "Own site + marketplaces + quick-commerce + offline", "FY26", 690.2, 25.9, 40.2, A, "PAT positive (FY25 loss of 31.5 Cr was one-off)", "High", 700, 2.4, 1.25, [("beau","Minimalist")], "Acquired by HUL in 2025."),
 ("Skillmatics", "Grasper Global Pvt Ltd (per filings)", "Toys & games", "Educational board games, card games, activity kits for kids", "Amazon-led + 3,000+ intl retail doors; 25+ countries (US-heavy)", "FY26", 659, 17.57, 11.5, A, "PAT positive", "Medium", 1600, 1.3, EXP, [("disc","Skillmatics")], "Mostly export revenue; customers are largely outside India."),
 ("Plum", "Pureplay Skin Sciences (India) Pvt Ltd", "Beauty & personal care", "Vegan skincare, bodycare (Plum BodyLovin'), haircare, makeup", "Own site + marketplaces + ~500+ offline doors/EBOs", "FY26", 515, 49, 41.8, A, "PAT positive (turned profitable FY25: 25 Cr)", "High", 650, 2.3, 1.25, [("beau","Plum")], "EBITDA derived from ~8.1% margin."),
 ("The Souled Store", "The Souled Store Pvt Ltd", "Fashion & apparel", "Pop-culture/licensed apparel - tees, hoodies, joggers, sneakers, accessories", "Own app/web majority + ~40+ stores", "FY25", 492.4, 11, 47.8, A, "PAT positive (profit fell 38% as FY24 had a tax credit)", "High", 1300, 1.8, 1.12, [("fash","The Souled Store")], "Company guides ~700 Cr for FY26 (unfiled)."),
 ("Ultrahuman", "Ultrahuman Healthcare Pvt Ltd", "Health tech wearables", "Ultrahuman Ring AIR, M1 CGM, Home environment device, subscriptions", "Own site + global retail (Best Buy etc.); mostly international", "FY25", 565, 73, 49.5, A, "PAT positive", "High", 30000, 1.1, 1.0, [("heal","Ultrahuman"),("disc","Ultrahuman")], "Hardware + subscription (~29 Cr). Majority of customers overseas."),
 ("BellaVita", "IDAM Natural Wellness Pvt Ltd", "Beauty & personal care", "Perfumes, fragrance gift sets, bath & body", "Own site + marketplaces + quick-commerce + offline", "FY25", 456, 25, 21, A, "PAT positive", "High", 800, 1.8, 1.2, [("beau","BellaVita"),("disc","BellaVita")], "EBITDA from ~4.6% margin."),
 ("Wonderchef", "Wonderchef Home Appliances Pvt Ltd", "Kitchen appliances & cookware", "Cookware, mixer grinders, air fryers, kitchen appliances", "Omnichannel: marketplaces, own site, modern trade, TV/direct selling", "FY25", 421, 4.4, 8.5, A, "PAT positive (thin)", "High", 2500, 1.3, OMNI, [("elec","Wonderchef"),("disc","Wonderchef")], "Inc42 variant: 430 Cr / 6 Cr."),
 ("Vahdam India", "Vahdam Teas Pvt Ltd", "Food & beverage", "Premium Indian teas, chai, tea gift sets, spices", "Own site + Amazon; ~96% exports (US/EU)", "FY26", 349.6, 32.2, 17.5, A, "PAT positive (first profitable year FY25: 5.2 Cr)", "High", 2000, 2.5, EXP, [("food","Vahdam India")], "Customers overwhelmingly outside India."),
 ("Beardo", "Zed Lifestyle Pvt Ltd (Marico)", "Men's grooming", "Beard oils & growth, perfumes, face wash, hair styling", "Marketplaces + own site + offline via Marico", "FY26", 299, 22.12, 31.6, A, "PAT positive", "Medium", 550, 2.0, OMNI, [("disc","Beardo"),("beau","Beardo")], "Marico subsidiary. FY25: 214 Cr / 13 Cr."),
 ("Innovist (Bare Anatomy, Chemist at Play)", "Innovist Pvt Ltd", "Beauty & personal care", "Haircare (Bare Anatomy), body care (Chemist at Play), sunscreen (Sunscoop)", "Marketplaces + own sites + quick-commerce", "FY25", 299, 12, 1, A, "PAT positive (turned profitable FY25)", "High", 600, 2.2, 1.2, [("beau","Bare Anatomy / Chemist at Play / Sunscoop"),("disc","Innovist (Bare Anatomy, Chemist at Play, Sunscoop)")], ""),
 ("The Bear House", "The Bear House (entity per filings)", "Fashion & apparel", "Premium men's shirts, polos, trousers, knitwear", "Own site + marketplaces + stores", "FY26", 270, 16, None, A, "PAT positive (FY26 company-stated; FY25 audited 130 Cr / 3.7 Cr)", "Medium", 2200, 1.6, 1.12, [("fash","The Bear House"),("disc","The Bear House")], "Repeat rate >60%; 62% customers from tier II+."),
 ("Urbano", "Bizotic Commercial Ltd (NSE SME)", "Fashion & apparel", "Men's jeans, casual wear, activewear", "Marketplace-led (Myntra/Flipkart/Amazon)", "FY26", 251, 18, 26, A, "PAT positive", "High", 1000, 1.8, DIG, [("disc","Urbano (Bizotic Commercial)")], "Listed SME; exchange-filed numbers."),
 ("Sat Kartar", "Sat Kartar Shopping Ltd (NSE SME)", "Ayurveda & wellness", "Ayurvedic products for diabetes, joints, digestion, weight management", "Tele-sales + own site + marketplaces", "FY26", 194, 17, 25, A, "PAT positive", "High", 2200, 2.5, DIG, [("disc","Sat Kartar")], "Listed SME; exchange-filed numbers."),
 ("Kay Beauty", "Kay Beauty (Nykaa JV; entity not confirmed)", "Beauty & personal care", "Celebrity-led colour cosmetics & skincare (Katrina Kaif)", "Mostly Nykaa online + Nykaa stores", "FY25", 132.4, 11, None, A, "PAT positive", "Medium", 1200, 2.0, 1.2, [("beau","Kay Beauty")], ""),
 ("Deconstruct", "Deconstruct (entity not confirmed)", "Beauty & personal care", "Science-led sunscreens, serums, moisturisers", "Marketplaces + own site + quick-commerce", "FY25", 127.1, 10, 10.3, A, "PAT positive", "Medium", 650, 2.2, 1.2, [("beau","Deconstruct")], "Inc42 figures - revenue may include other income; EBITDA is an Inc42 estimate."),
 ("Bonkers Corner", "Bonkers Corner (entity per filings)", "Fashion & apparel", "Streetwear - oversized tees, joggers, co-ords", "~55% own site, ~40% stores, ~5% marketplaces", "FY25", 122.8, 4.3, None, A, "PAT positive", "High", 1200, 1.8, 1.12, [("fash","Bonkers Corner"),("disc","Bonkers Corner")], "FY26 guidance: 180-195 Cr revenue, 15-16 Cr PAT."),
 ("Jaipur Kurti", "Nandani Creation Ltd (listed)", "Fashion & apparel", "Kurtas, kurta sets, ethnic wear for women", "Marketplace-led + own site", "FY26", 111, 2, 8, A, "PAT positive", "Medium", 1100, 1.6, DIG, [("fash","Jaipur Kurti")], "Screener figures are rounded."),
 ("Knya", "Knya (entity per filings)", "Fashion & apparel", "Medical scrubs, lab coats, healthcare apparel", "Own site + marketplaces + hospital B2B", "FY26", 110, 10, 20, A, "PAT positive", "Medium", 1800, 1.6, DIG, [("fash","Knya"),("disc","Knya")], "Disclosed: 15 lakh+ medical professionals served (cumulative)."),
 ("Beyoung", "Beyoung Folks Pvt Ltd (per filings)", "Fashion & apparel", "Value men's & women's casual wear, tees, shirts, jeans", "Own app/web + marketplaces", "FY25", 109.3, 1.2, 4.4, A, "PAT positive (thin)", "Medium", 900, 1.8, DIG, [("fash","Beyoung")], "Bootstrapped, Udaipur-based."),
 ("Phool", "Kanpur Flowercycling Pvt Ltd", "Home & fragrance", "Incense from temple flowers, home fragrance, dhoop, flower-based biomaterials", "Own site + marketplaces + quick-commerce", "FY25", 76.5, 2.5, None, A, "PAT positive (turned profitable FY25)", "High", 700, 2.5, 1.2, [("elec","Phool"),("disc","Phool")], ""),
 ("Mivi", "Seminole Electronics Pvt Ltd", "Consumer electronics", "Made-in-India TWS earbuds, soundbars, speakers", "Marketplace-led + own site", "FY25", 287, 1.2, 15.6, A, "PAT positive (thin)", "Medium", 1300, 1.2, 1.2, [("elec","Mivi")], "EBITDA is an Inc42 estimate."),
 ("Nasher Miles", "Nasher Miles (entity per filings)", "Luggage & bags", "Hard-shell luggage, backpacks, travel accessories", "Marketplace-led + own site + stores", "FY25", 145.5, 0.09, 2.7, A, "PAT positive (breakeven)", "Medium", 4000, 1.1, DIG, [("fash","Nasher Miles")], ""),
 ("Urban Ladder", "Urban Ladder Home Decor Solutions (Reliance Retail)", "Furniture & home", "Furniture, décor, furnishings", "Own site + stores", "FY25", 106, 4.9, 14.3, A, "PAT positive", "Medium", 25000, 1.05, DIG, [("elec","Urban Ladder")], "Reliance subsidiary; revenue down ~30% YoY."),
 ("Cosmix", "Cosmix Wellness (60% Marico)", "Health & nutrition", "Plant-based protein, wellness blends for women (PCOS, sleep, skin)", "Own site + marketplaces", "FY25", 50.93, 8.21, 11.4, A, "PAT positive (22% EBITDA margin)", "Medium", 1500, 2.5, DIG, [("disc","Cosmix")], "Marico acquired 60% in 2025."),
 ("Menhood", "Macobs Technologies Ltd (NSE SME)", "Men's grooming", "Men's intimate grooming trimmers, grooming kits", "Marketplace-led + own site", "FY26", 41.4, 3.1, 3.4, A, "PAT positive", "High", 1200, 1.5, DIG, [("disc","Menhood")], "Listed SME."),
 ("Signoria Creation", "Signoria Creation Ltd (NSE SME)", "Fashion & apparel", "Women's ethnic wear - kurtas, suit sets", "Marketplace-led", "FY26", 40.45, 4.19, 7.93, A, "PAT positive", "High", 1000, 1.6, DIG, [("disc","Signoria Creation")], "Listed SME; marketplace-led rather than own-site D2C."),
 ("Desi Farms", "Desi Farms (entity per filings)", "Dairy & fresh", "A2/farm milk, curd, ghee, paneer - subscription delivery", "App subscription (daily delivery)", "FY25", 38, 2, None, A, "PAT positive", "Medium", 2000, 12, 1.05, [("disc","Desi Farms")], "AOV treated as a monthly subscription bill."),
 # ---------------- Tier B: profitable with a caveat ----------------
 ("CaratLane", "CaratLane Trading Pvt Ltd (Titan subsidiary)", "Fine jewellery", "Diamond & gold jewellery, everyday fine jewellery", "Omnichannel: web/app + ~300 stores", "FY26", 4702, None, None, B, "Profitable at PBT level (FY25 PBT 296 Cr); FY26 PAT not separately found", "Medium", 30000, 1.15, EXP, [("elec","CaratLane")], "Titan-owned; started digital-first, now store-heavy."),
 ("Milky Mist", "Milky Mist Dairy Food Ltd", "Dairy & fresh", "Paneer, curd, cheese, butter, yoghurt", "Distributor-led general trade + modern trade; not digital-first", "FY25", 2349, 46, 307.7, B, "PAT positive - weak D2C fit", "Medium", 150, 24, OFF, [("food","Milky Mist")], "Included as a direct-brand consumer business; orders = retail consumer transactions. EBITDA from 13.1% margin."),
 ("Cellecor", "Cellecor Gadgets Ltd (NSE SME)", "Consumer electronics", "Budget smartphones, feature phones, smart TVs, wearables, audio", "Marketplaces + heavy offline distribution", "FY26", 1292, 40, 71, B, "PAT positive - offline-leaning distribution", "High", 5000, 1.1, 1.35, [("elec","Cellecor"),("disc","Cellecor")], "Listed SME."),
 ("Go Colors", "Go Fashion (India) Ltd (listed)", "Fashion & apparel", "Women's bottom-wear - leggings, pants, jeggings", "Store-led (~800 EBOs) + online", "FY26", 838, 59.18, 237, B, "PAT positive - store-led, not digital-first", "High", 1500, 2.0, 1.1, [("fash","Go Colors")], "Direct-to-consumer via own stores; EBITDA includes Ind-AS 116."),
 ("iD Fresh Food", "iD Fresh Food (India) Pvt Ltd", "Food & beverage", "Idli/dosa batter, parotas, ready-to-cook foods", "Retail/general trade + quick-commerce + app", "FY25", 681.37, 25.87, 59.3, B, "PAT positive - retail-led", "Medium", 120, 20, OFF, [("food","iD Fresh Food")], "EBITDA from 8.7% margin."),
 ("Forest Essentials", "Mountain Valley Springs India Pvt Ltd", "Beauty & personal care", "Luxury Ayurvedic skincare, bath & body, fragrance", "Store-led (100+ stores) + own site", "FY25", 580, 130, None, B, "Profitable - figure may be EBITDA, not PAT; store-led", "Low", 3500, 2.0, 1.15, [("beau","Forest Essentials")], "Estée Lauder minority stake. The Ken figure."),
 ("Livpure", "Livpure Pvt Ltd", "Appliances", "RO water purifiers, air coolers, mattresses (Livpure Sleep), subscription purifiers", "Offline dealers + online; not digital-first", "FY25", 578.9, 7.9, 20.0, B, "PAT positive - weak D2C fit", "Medium", 12000, 1.05, 1.35, [("elec","Livpure")], "EBITDA Inc42 estimate."),
 ("Lahori Zeera", "Archian Foods Pvt Ltd", "Food & beverage", "Jeera soda, nimbu soda, shikanji - ethnic carbonated drinks", "Distributor-led general trade", "FY25", 540, 25, 54, B, "PAT positive - distribution-led, not digital-first", "Medium", 20, 20, OFF, [("food","Lahori Zeera")], "Orders = retail consumer transactions of ~Rs 20 SKUs. EBITDA from ~10% margin."),
 ("Snitch", "Snitch Apparels Pvt Ltd", "Fashion & apparel", "Fast-fashion menswear - shirts, tees, jeans, co-ords", "~60% online (own app/web + marketplaces), ~40% via 115 stores", "FY25", 498, -1.7, -5.0, B, "PAT positive FY24 (4.4 Cr); near-breakeven loss FY25", "High", 1500, 1.8, 1.12, [("fash","Snitch"),("disc","Snitch")], "FY26 founder-stated (unaudited): ~900 Cr revenue, 2-3% EBITDA."),
 ("Plix", "Satiya Nutraceuticals Pvt Ltd (60% Marico)", "Health & nutrition", "Plant-based supplements, effervescents, skincare (Jagger/ACV)", "Own site + marketplaces + quick-commerce", "FY25", 436.3, 4.8, 11.2, B, "Disputed: Inc42 shows +4.8 Cr; another note shows -41.7 Cr", "Low", 900, 2.5, 1.2, [("heal","Plix (The Plant Fix)")], "Check Marico's subsidiary financials to settle."),
 ("Traya", "Traya Health (entity per filings)", "Health & wellness", "Hair-loss treatment kits (Ayurveda + dermatology + nutrition), diagnosis-led", "Own app/web subscription", "FY25", 338, -22.5, -20.6, B, "PAT positive FY24 (8.7 Cr); loss in FY25", "High", 2500, 4.0, 1.1, [("heal","Traya"),("disc","Traya")], "Disclosed: 8 lakh+ customers (cumulative)."),
 ("Swiss Military", "Swiss Military Consumer Goods Ltd (listed)", "Luggage & lifestyle", "Luggage, bags, watches, home & kitchen, electronics", "Marketplaces + offline", "FY26", 251, 8, 11, B, "PAT positive - licensed brand, weak D2C fit", "High", 2000, 1.2, 1.35, [("disc","Swiss Military")], ""),
 ("Zappfresh", "DSM Fresh Foods Ltd (NSE SME)", "Food & beverage", "Fresh meat, seafood, ready-to-cook & marinated meats", "App/web delivery + B2B (~68% of revenue)", "FY26", 222.3, 14.4, 32.2, B, "PAT positive - majority B2B revenue", "High", 600, 6, DIG, [("food","Zappfresh"),("disc","Zappfresh")], "Customer estimate uses only the ~32% B2C share of revenue."),
 ("R for Rabbit", "R for Rabbit Baby Products (entity per filings)", "Baby & kids", "Strollers, car seats, cribs, baby gear", "Marketplaces + own site + offline", "FY24", 170, 2.21, None, B, "PAT positive FY24 only; later year near-breakeven/loss", "Medium", 6000, 1.3, 1.2, [("disc","R for Rabbit")], ""),
 ("Loom Solar", "Loom Solar Pvt Ltd", "Energy & electronics", "Solar panels, inverters, lithium batteries for homes", "Own site + marketplaces + dealer network", "FY24", 151.5, 9, 14.1, B, "PAT positive FY24 (latest found)", "Medium", 25000, 1.02, 1.2, [("disc","Loom Solar")], ""),
 ("Dr Trust", "Nureca Ltd (listed)", "Health devices", "BP monitors, glucometers, oximeters, massagers, fitness devices", "Marketplace-led + own site", "FY26", 147, 2, 0, B, "PAT positive only via other income (EBITDA ~0)", "High", 1800, 1.2, DIG, [("elec","Dr Trust"),("disc","Nureca (Dr Trust)")], "Discovery source shows PAT ~0.3 Cr."),
 ("Boldfit", "Bling Brands Pvt Ltd", "Fitness & nutrition", "Gym accessories, yoga mats, resistance bands, supplements", "Amazon-led + own site", "FY25*", 139.7, 16.81, None, B, "PAT positive - fiscal year uncertain (may be FY24)", "Medium", 700, 1.8, DIG, [("heal","Boldfit")], ""),
 ("Kiaasa", "Kiaasa Retail Ltd (NSE SME)", "Fashion & apparel", "Women's ethnic wear - kurtas, suits, dupattas", "Store-led + online", "FY26", 135, 11, 23, B, "PAT positive - store-led", "High", 1800, 1.6, 1.12, [("disc","Kiaasa")], ""),
 ("Raw Pressery", "Rakyan Beverages Pvt Ltd", "Food & beverage", "Cold-pressed juices, smoothies, coconut water", "Modern trade + quick-commerce + online", "FY25", 154.2, 8.3, 23.8, B, "PAT positive - single source (Inc42)", "Low", 120, 10, OFF, [("food","Raw Pressery")], "Orders = retail consumer transactions."),
 ("Carbamide Forte", "Novus Life Sciences Pvt Ltd", "Health & nutrition", "Vitamins, multivitamins, biotin, omega-3 supplements", "Amazon-led + own site", "FY25", 109.09, None, None, B, "Profitable FY23; FY25 PAT paywalled", "Low", 900, 3.0, DIG, [("heal","Carbamide Forte")], ""),
 ("Nutrabay", "Nutrabay Retail Pvt Ltd", "Health & nutrition", "Sports nutrition (own label + multibrand), whey, creatine", "Own app/web", "FY24", 99, 1.22, 2.26, B, "PAT positive FY24 (latest found)", "Medium", 2000, 3.0, 1.1, [("heal","Nutrabay"),("disc","Nutrabay")], "Disclosed AOV ~Rs 2,000; 1.5M+ private-label customers; 15-20k new customers/month."),
 ("Zoff Foods", "Zoff Foods (entity per filings)", "Food & beverage", "Spices, masalas, dry fruits", "Marketplace-led + own site", "FY24", 93, 1, None, B, "PAT positive FY24 (gross/claimed revenue)", "Low", 450, 3.0, DIG, [("disc","Zoff")], ""),
 ("Mars Cosmetics", "Mars Cosmetics (entity per filings)", "Beauty & personal care", "Affordable makeup - lipsticks, kajal, eyeshadow palettes", "Offline distribution + marketplaces", "FY24", 47.6, 3.4, None, B, "PAT positive FY24; low confidence (mgmt claims ~200 Cr revenue)", "Low", 350, 2.5, OFF, [("beau","Mars Cosmetics")], ""),
 ("Palmonas", "Palmonas (entity per filings)", "Fashion jewellery", "Demi-fine 18k gold-plated, waterproof jewellery", "Own site + ~78 stores", "FY25", 39, 4.3, None, B, "PAT positive per one source; Inc42 shows 10.8 Cr revenue & small loss", "Low", 1800, 1.5, 1.1, [("fash","Palmonas"),("elec","Palmonas"),("disc","Palmonas")], "Conflicting sources."),
 ("Blue Tea", "Blue Tea (entity per filings)", "Food & beverage", "Butterfly-pea flower tea, herbal teas", "Marketplaces + own site", "FY25", 37, None, None, B, "Claimed profitable; PAT amount undisclosed", "Low", 500, 2.5, DIG, [("disc","Blue Tea")], "Disclosed: 25 lakh+ consumers (cumulative), ~5,200 units/day."),
 ("Dogsee Chew", "Dogsee Chew (entity per filings)", "Pet care", "Himalayan yak-cheese dog chews, pet treats", "Marketplaces + own site + exports", "FY25", 35.6, -19.8, -15.0, B, "Claims PAT-positive in FY26; FY25 filed loss", "Low", 600, 4.0, DIG, [("heal","Dogsee Chew"),("disc","Dogsee Chew")], ""),
 ("Hammer", "Hammer Lifestyle (entity per filings)", "Consumer electronics", "Earbuds, smartwatches, speakers", "Marketplace-led + own site", "FY23", 24.4, 0.6, 1.0, B, "PAT positive FY23 (stale)", "Low", 1200, 1.2, DIG, [("elec","Hammer")], ""),
 ("Kyari", "Kyari (entity per filings)", "Home & garden", "Indoor plants, planters, gardening kits", "Own site + quick-commerce", "FY26", 20, None, None, B, "Claimed profitable; PAT amount undisclosed", "Low", 800, 2.0, DIG, [("disc","Kyari")], "Disclosed: 10 lakh+ customers; ~25% revenue from repeat."),
 ("Jewelbox", "Jewelbox (entity per filings)", "Fine jewellery", "Lightweight 14k/18k gold & diamond jewellery", "~40% online, rest stores/B2B", "FY24", 14.3, 1.6, None, B, "PAT positive FY24; sub-20 Cr scale", "Medium", 15000, 1.2, EXP, [("disc","Jewelbox")], ""),
 ("Tjori", "Tjori (entity per filings)", "Fashion & home", "Ethnic apparel, home décor, handcrafted accessories", "Own site + marketplaces", "FY25", 6.1, 0.025, 0.6, B, "PAT positive (breakeven; very small)", "Medium", 1500, 1.5, DIG, [("fash","Tjori")], ""),
 ("Epigamia", "Drums Food International Pvt Ltd", "Food & beverage", "Greek yoghurt, smoothies, mishti doi, protein snacks", "Modern trade + quick-commerce + 20,000 outlets", "FY25/26", 500, None, None, B, "Claimed profitable; revenue is a claimed ARR (>500 Cr); last filed FY23 = 172 Cr rev / -67 Cr", "Low", 60, 12, OFF, [("disc","Epigamia"),("food","Epigamia")], "Treat both revenue and profit as company claims."),
 # ---------------- Tier C: profit-adjacent (EBITDA-positive / near-breakeven / historically profitable) ----------------
 ("Country Delight", "SKI Business Services Pvt Ltd (per filings)", "Dairy & fresh", "Milk, dairy, fresh produce, staples - daily subscription", "Own app subscription", "FY24", 1380, None, None, C, "PAT not found; FY23 loss 249 Cr - reported EBITDA-positive trajectory", "Low", 250, 60, 1.05, [("food","Country Delight")], "Disclosed (2022): 5M+ orders/month."),
 ("Mosaic Wellness (Man Matters, Be Bodywise, Little Joys)", "Mosaic Wellness Pvt Ltd", "Health & wellness", "Hair-loss & sexual wellness (Man Matters), women's health (Be Bodywise), kids nutrition (Little Joys)", "Own apps/web + marketplaces", "FY25", 736, -12, -7.5, C, "Near-breakeven FY25; reportedly turned profitable in FY26 (unaudited)", "Medium", 900, 2.5, DIG, [("heal","Mosaic Wellness (Man Matters, Be Bodywise, Little Joys)"),("disc","Mosaic Wellness (Man Matters, Be Bodywise, Little Joys)")], ""),
 ("Portronics", "Portronics Digital Pvt Ltd (per filings)", "Consumer electronics", "Power banks, chargers, speakers, keyboards, mobile accessories", "Marketplace-led + offline + own site; bootstrapped", "FY25", 713.6, None, None, C, "PAT paywalled; bootstrapped, historically profitable", "Low", 900, 1.3, 1.25, [("elec","Portronics")], ""),
 ("Paper Boat", "Hector Beverages Pvt Ltd", "Food & beverage", "Ethnic juices & drinks (aam panna, kokum), Paper Boat Swing", "Distributor-led + modern trade + quick-commerce", "FY25", 668.28, -48.25, None, C, "Disputed: Entrackr shows -48 Cr loss, BW Retail shows +46 Cr profit", "Low", 30, 20, OFF, [("food","Paper Boat")], ""),
 ("Bombay Shaving Company", "Bombay Shaving Company Pvt Ltd", "Men's & women's grooming", "Razors, shaving kits, beard care, Bombae women's grooming", "Marketplaces + own site + offline", "FY26", 635, -9, 2, C, "Adjusted EBITDA positive (2 Cr); PAT loss 9 Cr", "High", 500, 2.5, OMNI, [("beau","Bombay Shaving Company (+Bombae)")], ""),
 ("Libas", "Zivore Apparel Pvt Ltd", "Fashion & apparel", "Women's ethnic wear - kurtas, suit sets, co-ords", "Own app/web ~40-45%, marketplaces, stores", "FY25", 609.1, -16.5, None, C, "Near-breakeven loss (-2.7% margin); earlier years profitable", "Medium", 1300, 1.8, 1.12, [("fash","Libas")], "Not the same company as listed Libas Consumer Products Ltd."),
 ("Lifelong", "Lifelong Online Retail Pvt Ltd", "Home appliances & fitness", "Mixer grinders, kitchen appliances, treadmills, fitness equipment", "Amazon-led + own site", "FY25", 540.48, None, None, C, "PAT paywalled; bootstrapped, historically profitable", "Low", 2500, 1.15, DIG, [("elec","Lifelong")], ""),
 ("Dot & Key", "Dot & Key Wellness (Nykaa subsidiary)", "Beauty & personal care", "Sunscreens, vitamin C, watermelon & ceramide skincare", "Nykaa + marketplaces + quick-commerce + own site", "FY25", 529, None, 74, C, "14% EBITDA margin; PAT not disclosed (very likely positive)", "Medium", 650, 2.2, 1.25, [("disc","Dot & Key")], ""),
 ("Swiss Beauty", "Swiss Beauty Cosmetics Pvt Ltd", "Beauty & personal care", "Affordable colour cosmetics - primers, foundations, lip colours", "Offline-heavy + marketplaces", "FY25", 382.7, None, None, C, "FY25 PAT paywalled; FY23 PAT 36.4 Cr on 196.5 Cr", "Low", 400, 2.5, OFF, [("beau","Swiss Beauty")], ""),
 ("Kushal's Fashion Jewellery", "Kushal's Retail Pvt Ltd (per filings)", "Fashion jewellery", "Fashion & silver jewellery, accessories", "Store-led (100+ stores) + own site", "FY25", 330, None, None, C, "PAT paywalled; reported profitable historically", "Low", 1800, 1.5, 1.05, [("elec","Kushal's")], ""),
 ("Happilo", "Happilo International Pvt Ltd", "Food & beverage", "Dry fruits, nuts, trail mixes, seeds, chocolates", "Marketplaces + modern trade + quick-commerce", "FY25", 280, -9.5, 3, C, "EBITDA positive (3 Cr); PAT loss", "Medium", 600, 3.0, 1.35, [("food","Happilo")], ""),
 ("OZiva", "Zywie Ventures Pvt Ltd (HUL)", "Health & nutrition", "Plant-based protein, collagen builders, women's nutrition", "Own site + marketplaces + offline", "FY25", 260.9, -4.5, -3.4, C, "Near-breakeven loss (-1.7%)", "Medium", 1200, 2.5, 1.2, [("heal","OZiva")], ""),
 ("Heads Up For Tails", "Heads Up For Tails (Joopy)", "Pet care", "Pet food, treats, accessories, grooming & spa", "~100 stores + own app/web", "FY25", 236.8, -3.3, 4.8, C, "EBITDA positive; small PAT loss", "Medium", 1800, 4.0, 1.12, [("heal","Heads Up For Tails")], ""),
 ("Ambrane", "Ambrane India Pvt Ltd (per filings)", "Consumer electronics", "Power banks, chargers, cables, smartwatches", "Marketplace-led + offline", "FY24", 230, None, None, C, "Founder claim of profitability; filed PAT not found", "Low", 900, 1.3, 1.25, [("elec","Ambrane")], "Revenue approximate (founder)."),
 ("Just Herbs", "Just Herbs (Marico majority)", "Beauty & personal care", "Ayurvedic skincare, makeup, haircare", "Own site + marketplaces + Marico distribution", "FY25", 200, None, None, C, "Profit status unconfirmed; revenue may be run-rate", "Low", 800, 2.2, 1.2, [("beau","Just Herbs")], ""),
 ("Fast&Up", "Aeronutrix Sports Products Pvt Ltd", "Health & nutrition", "Effervescent electrolytes, vitamins, sports nutrition", "Offline + marketplaces + own site", "FY24", 188, None, None, C, "PAT not found", "Low", 800, 3.0, 1.3, [("heal","Fast&Up")], ""),
 ("Sukkhi", "Sukkhi (entity per filings)", "Fashion jewellery", "Fashion & bridal imitation jewellery", "Marketplace-led", "FY25", 145.7, None, None, C, "PAT paywalled; historically profitable", "Low", 700, 1.5, DIG, [("elec","Sukkhi")], "Claims 60 lakh+ consumers (cumulative)."),
 ("Kama Ayurveda", "Kama Ayurveda Pvt Ltd (Puig majority)", "Beauty & personal care", "Luxury Ayurvedic skincare, hair oils, bath & body", "Stores + own site + Nykaa", "FY25", 141, None, None, C, "PAT not found; Puig-owned premium brand", "Low", 2500, 2.0, 1.15, [("beau","Kama Ayurveda")], ""),
 ("FabAlley / Indya", "Tsg (entity per filings)", "Fashion & apparel", "Western (FabAlley) and ethnic (Indya) womenswear", "Own site + marketplaces + stores", "FY25", 122, None, None, C, "PAT not found", "Low", 1600, 1.6, 1.12, [("fash","FabAlley / Indya")], ""),
 ("House of Masaba", "House of Masaba Lifestyle (Nykaa subsidiary)", "Fashion & beauty", "Designer apparel, Lovechild beauty, jewellery", "Stores + own site + Nykaa", "FY25", 115.88, None, None, C, "PAT not found", "Low", 3500, 1.5, 1.12, [("fash","House of Masaba")], ""),
 ("Pure Home + Living", "Pure Home + Living (entity per filings)", "Home décor", "Tableware, décor, soft furnishings, lighting", "Stores + own site", "FY25", 108, None, None, C, "PAT paywalled", "Low", 3000, 1.3, 1.12, [("elec","Pure Home + Living")], ""),
 ("Two Brothers Organic Farms", "Two Brothers Organic Farms (entity per filings)", "Food & beverage", "A2 cow ghee, jaggery, stone-ground flours, organic staples", "Own site (+exports) + marketplaces", "FY25", 98.6, None, None, C, "PAT not found; bootstrapped", "Low", 1800, 3.0, DIG, [("food","Two Brothers Organic Farms")], ""),
 ("Nua", "Nua (entity per filings)", "Feminine care", "Sanitary pads, period care subscription, wellness", "Own site subscription + marketplaces", "FY25", 96.1, -7.0, -6.8, C, "Near-breakeven loss", "Medium", 450, 5.0, DIG, [("heal","Nua")], ""),
 ("Pee Safe", "Redcliffe Hygiene Pvt Ltd", "Hygiene & feminine care", "Toilet-seat sanitiser, menstrual care, intimate hygiene", "Marketplaces + own site + offline", "FY25", 82, -4, -3.4, C, "Near-breakeven loss", "Medium", 450, 3.0, 1.2, [("heal","Pee Safe")], ""),
 ("Bacca Bucci", "Bacca Bucci (entity per filings)", "Footwear", "Sneakers, boots, casual & sports footwear", "Marketplace-led + own site", "FY25", 81.7, -3.9, None, C, "Near-breakeven loss", "Medium", 1500, 1.4, DIG, [("fash","Bacca Bucci")], ""),
 ("Suta", "Suta (entity per filings)", "Fashion & apparel", "Handloom sarees, cotton & mulmul womenswear", "Own site + stores", "FY25", 73.5, -0.3, None, C, "Breakeven (-0.3 Cr)", "Medium", 3000, 1.5, 1.1, [("fash","Suta")], ""),
 ("Arata", "Arata (entity per filings)", "Beauty & personal care", "Clean, plant-based hair & body care", "Marketplaces 38%, own site 32%, quick-commerce 30%", "FY25", 61.1, None, None, C, "PAT not found", "Low", 600, 2.5, 1.2, [("beau","Arata")], "Disclosed: 50,000+ own-site orders/month."),
 ("MyMuse", "MyMuse (entity per filings)", "Sexual wellness", "Personal massagers, lubricants, intimacy products", "Own site + marketplaces", "FY25", 54, -3.8, -3.8, C, "Near-breakeven loss", "Medium", 2500, 1.3, DIG, [("heal","MyMuse")], ""),
 ("Re'equil", "Re'equil (entity per filings)", "Beauty & personal care", "Dermatologist-style skincare - sunscreens, acne care", "Own site + marketplaces", "FY23", 47.5, None, None, C, "Bootstrapped; PAT not found (FY23 data only)", "Low", 800, 2.2, DIG, [("beau","Re'equil")], ""),
 ("Sleepy Owl", "Sleepy Owl Coffee Pvt Ltd", "Food & beverage", "Cold-brew packs, instant coffee, coffee pods", "Own site + quick-commerce + modern trade", "FY25", 44.4, -2.1, None, C, "Near-breakeven loss", "Medium", 600, 3.0, 1.2, [("food","Sleepy Owl")], ""),
 ("Conscious Chemist", "Conscious Chemist (entity per filings)", "Beauty & personal care", "Skincare - acne care, serums, sunscreens", "Marketplaces + own site", "FY25", 31.9, None, None, C, "PAT not found", "Low", 600, 2.2, DIG, [("beau","Conscious Chemist")], ""),
 ("Earth Rhythm", "Earth Rhythm (entity per filings)", "Beauty & personal care", "Clean skincare, haircare, bath & body", "Own site + marketplaces", "FY25", 26.7, None, None, C, "PAT not found", "Low", 800, 2.2, DIG, [("beau","Earth Rhythm")], ""),
 ("Juicy Chemistry", "Juicy Chemistry (entity per filings)", "Beauty & personal care", "Certified-organic skincare, oils, haircare", "Own site + marketplaces", "FY25", 20.6, None, None, C, "PAT not found; bootstrapped", "Low", 1000, 2.2, DIG, [("beau","Juicy Chemistry")], ""),
]

# Brands whose orders should use only a fraction of revenue (B2C share)
B2C_SHARE = {"Zappfresh": 0.32}

def fnum(x, nd=1):
    if x is None: return ""
    return f"{x:,.{nd}f}".replace(",", "")

def humanize(n):
    return int(round(n, -3)) if n >= 10000 else int(round(n, -2))

def pull(keys, field):
    vals = []
    for k in keys:
        r = research.get(k)
        if r and r.get(field) and r[field] not in vals:
            vals.append(r[field])
    return " | ".join(vals)

out_rows = []
for i, (brand, entity, cat, prods, chan, fy, rev, pat, ebitda, tier, status, conf, aov, freq, gu, keys, notes) in enumerate(ROWS):
    for k in keys:
        assert k in research, f"missing research row {k}"
    share = B2C_SHARE.get(brand, 1.0)
    spend = rev * 1e7 * gu * share
    orders = spend / aov
    uniq = orders / freq
    per_month = uniq * min(1.0, freq / 12)
    out_rows.append({
        "tier": tier, "brand": brand, "parent_entity": entity, "category": cat, "key_products": prods,
        "channel_mix": chan, "fiscal_year": fy,
        "revenue_inr_cr": fnum(rev), "pat_bottomline_inr_cr": fnum(pat, 2) if pat is not None else "",
        "pat_margin_pct": fnum(pat / rev * 100) if pat is not None else "",
        "ebitda_inr_cr": fnum(ebitda) if ebitda is not None else "",
        "ebitda_margin_pct": fnum(ebitda / rev * 100) if ebitda is not None else "",
        "profitability_status": status, "data_confidence": conf,
        "est_aov_inr": aov, "est_purchase_freq_per_year": freq, "gross_up_factor": gu,
        "est_orders_per_year": humanize(orders), "est_orders_per_month": humanize(orders / 12),
        "est_unique_customers_per_year": humanize(uniq),
        "est_unique_customers_per_year_range": f"{humanize(uniq*0.6)}-{humanize(uniq*1.5)}",
        "est_active_customers_per_month": humanize(per_month),
        "disclosed_customer_metric": pull(keys, "customer_metric"),
        "notes": notes, "source_urls": pull(keys, "source_url"),
    })

# rank: tier, then revenue desc
out_rows.sort(key=lambda r: (r["tier"], -float(r["revenue_inr_cr"])))
for n, r in enumerate(out_rows, 1):
    r["rank"] = n
cols = ["rank"] + [c for c in out_rows[0] if c != "rank"]
with open(OUT, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader(); w.writerows(out_rows)

names = [r["brand"] for r in out_rows]
assert len(names) == len(set(names)), "duplicate brands"
from collections import Counter
print(len(out_rows), Counter(r["tier"] for r in out_rows))
